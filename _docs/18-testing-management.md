---
title: "Testing and Management"
order: 18
part: system-management
description: "Test Message, Detour, Smart Proxy, and Channel Adapter management — patterns that keep a running integration system testable and manageable."
duration: "35 minutes"
---

The previous chapter covered observability — knowing what's happening in the system. This chapter covers the complementary concern: verifying the system works correctly, routing messages through alternate paths for debugging, and managing the adapters that connect to external systems.

{% include excalidraw.html file="18-testing-patterns" alt="Test Message and Detour patterns" caption="Figure 18.1 — Test Message injection and Detour toggle" %}

## Pattern: Test Message

### The problem

How do you know the order processing pipeline is working right now? The monitoring dashboard shows messages flowing, but are they being processed correctly? A subtle bug might silently corrupt data — the pipeline looks healthy from the outside while producing wrong results.

You need to send a known message through the system and verify that the output matches what you expect — a synthetic health check for the entire pipeline.

### The solution

A **Test Message** is a message with known content that's injected into the system periodically. The sender knows what the output should be; a verifier at the end of the pipeline checks the actual output against the expected result. If they don't match, the system is misbehaving.

Test messages are:
- **Synthetic** — Not real business data. They carry a flag (like `test: true`) so they can be filtered out of business processing.
- **Periodic** — Sent on a schedule (every 5 minutes, every hour) to continuously verify system health.
- **End-to-end** — They traverse the full pipeline, not just individual routes.

### How Camel models it

```java
// Test message injector: send a synthetic order every 5 minutes
from("timer:test-message?period=300000")
    .routeId("test-message-injector")
    .process(exchange -> {
        Map<String, Object> testOrder = new java.util.LinkedHashMap<>();
        testOrder.put("order_id", -1);  // Negative ID = test order
        testOrder.put("customer_id", "TEST-CUSTOMER");
        testOrder.put("item_sku", "TEST-SKU-001");
        testOrder.put("quantity", 1);
        testOrder.put("amount", 99.99);
        testOrder.put("destination_country", "US");
        testOrder.put("test_message", true);
        testOrder.put("test_injected_at", java.time.Instant.now().toString());
        exchange.getIn().setBody(testOrder);
    })
    .setHeader("isTestMessage", constant("true"))
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092")
    .log("Test message injected");

// Test message verifier: check that the test order was processed correctly
from("kafka:eip.orders.processed?brokers=localhost:9092&groupId=test-verifier")
    .routeId("test-message-verifier")
    .unmarshal().json(Map.class)
    .filter(simple("${body[test_message]} == true"))
        .process(exchange -> {
            Map<String, Object> result = exchange.getIn().getBody(Map.class);
            boolean passed = "PROCESSED".equals(result.get("status"))
                && result.containsKey("processed_at");
            exchange.getIn().setHeader("testPassed", passed);
            if (!passed) {
                exchange.getIn().setHeader("testFailureReason",
                    "Expected PROCESSED status, got: " + result.get("status"));
            }
        })
        .choice()
            .when(header("testPassed").isEqualTo(true))
                .log("Test message PASSED")
                .to("micrometer:counter:test.messages.passed")
            .otherwise()
                .log("Test message FAILED: ${header.testFailureReason}")
                .to("micrometer:counter:test.messages.failed")
                .to("direct:alert-test-failure")
        .end()
    .end();

// Business routes must filter out test messages
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("business-route-with-test-filter")
    .unmarshal().json(Map.class)
    .filter(simple("${header.isTestMessage} != 'true'"))
        .to("direct:check-inventory")
    .end();
```

### Test messages vs. Camel test framework

Test messages are *runtime* health checks — they verify the system works in production. The Camel test framework (`camel-test`, `camel-quarkus-junit5`) verifies the system works in development:

```java
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
public class OrderPipelineTest {

    @Inject
    ProducerTemplate producer;

    @EndpointInject("mock:result")
    MockEndpoint mockResult;

    @Test
    void testOrderFlowsThrough() throws Exception {
        mockResult.expectedMessageCount(1);
        mockResult.expectedHeaderReceived("orderId", "42");

        Map<String, Object> order = Map.of(
            "order_id", 42,
            "customer_id", "CUST-100",
            "amount", 149.99
        );
        producer.sendBody("direct:create-order", order);

        mockResult.assertIsSatisfied();
    }
}
```

Use both: the test framework in CI/CD, test messages in production.

## Pattern: Detour

### The problem

A bug in the enrichment step is corrupting customer emails. You need to bypass the enrichment step for all messages while you investigate — without deploying new code. Once the fix is ready, you re-enable enrichment.

### The solution

A **Detour** is a conditional bypass in a route. When enabled, messages skip one or more processing steps. When disabled, messages flow through normally. It's a runtime toggle — typically controlled by a feature flag, a configuration property, or a control bus command.

### How Camel models it

```java
// Detour: bypass enrichment based on a configuration flag
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=detour-example")
    .routeId("detour")
    .unmarshal().json(Map.class)
    .to("direct:validate")
    .choice()
        .when().simple("{{feature.enrichment.enabled:true}}")
            .log("Enrichment enabled — enriching order")
            .to("direct:enrich-order")
        .otherwise()
            .log("Enrichment DETOURED — skipping")
    .end()
    .to("direct:process-order");
```

### Feature flags with Quarkus

The `{% raw %}{{feature.enrichment.enabled:true}}{% endraw %}` syntax reads from Quarkus configuration. Toggle the detour at runtime:

```properties
# application.properties — default
feature.enrichment.enabled=true

# Override at runtime via environment variable
FEATURE_ENRICHMENT_ENABLED=false
```

In a Kubernetes environment, update the ConfigMap and restart the pod (or use a config reload mechanism) to toggle the detour without redeploying.

### Detour vs. stopping a route

You could achieve a similar effect by stopping the enrichment route via the control bus. But a detour is more surgical — it skips a specific *step* within a route, not the entire route. Messages continue flowing; they just take a different path.

## Pattern: Smart Proxy

### The problem

Payment-service calls an external payment gateway API. In production, you want the actual gateway. In development, you want a mock that returns predictable results. In staging, you want the gateway's sandbox environment. And for certain test orders, you want to intercept the request, log it, and forward it to the actual gateway.

### The solution

A **Smart Proxy** sits between the caller and the target service. It can:
- **Route** to different backends based on environment or message content.
- **Log** requests and responses for debugging.
- **Transform** requests/responses (e.g., mask credit card numbers in logs).
- **Mock** responses for testing without hitting the real service.

### How Camel models it

```java
// Smart proxy: route to real or mock payment gateway
from("direct:payment-gateway")
    .routeId("smart-proxy")
    .log("Payment request for ${body[order_id]}: $${body[amount]}")
    // Log the request (with PII redacted)
    .wireTap("direct:log-payment-request")
    .choice()
        .when().simple("{{payment.gateway.mode:production}} == 'mock'")
            .log("MOCK: simulating payment success")
            .process(exchange -> {
                Map<String, Object> mockResponse = new java.util.LinkedHashMap<>();
                mockResponse.put("status", "AUTHORIZED");
                mockResponse.put("transaction_id", "MOCK-" + System.currentTimeMillis());
                mockResponse.put("gateway", "mock");
                exchange.getIn().setBody(mockResponse);
            })
        .when().simple("{{payment.gateway.mode:production}} == 'sandbox'")
            .log("SANDBOX: calling sandbox gateway")
            .marshal().json()
            .to("http://sandbox.payment-gateway.example.com/charge"
                + "?httpMethod=POST&connectTimeout=10000")
            .unmarshal().json(Map.class)
        .otherwise()
            .log("PRODUCTION: calling live gateway")
            .marshal().json()
            .to("http://api.payment-gateway.example.com/charge"
                + "?httpMethod=POST&connectTimeout=10000")
            .unmarshal().json(Map.class)
    .end()
    // Log the response
    .wireTap("direct:log-payment-response")
    .log("Payment result: ${body[status]} (txn: ${body[transaction_id]})");
```

### Smart proxy and Quarkus profiles

Quarkus profiles make the smart proxy configuration seamless:

```properties
# application.properties — production by default
payment.gateway.mode=production

# %dev profile — mock for local development
%dev.payment.gateway.mode=mock

# %staging profile — sandbox for staging
%staging.payment.gateway.mode=sandbox
```

When you run `camel run` with JBang (which starts in dev mode by default), the mock profile activates automatically. No code changes needed.

## Pattern: Channel Adapter Management

### The problem

The shipping domain has channel adapters connecting to external systems: carrier APIs (FedEx, UPS, DHL), the partner order system, the accounting CSV drop, the legacy CRM SOAP service. Each adapter might fail independently — the FedEx API might be down while UPS is fine. You need to manage these adapters: monitor their health, retry on failure, and gracefully degrade when external systems are unavailable.

### The solution

Managing channel adapters is about combining several patterns we've already covered:

1. **Circuit Breaker** (Part 1) — Protect against cascading failures when an external system is down.
2. **Dead Letter Channel** (Part 3) — Route messages that fail after retries to a dead letter topic.
3. **Control Bus** (this chapter) — Start/stop individual adapters.
4. **Wire Tap** (this chapter) — Monitor adapter health metrics.

### How Camel models it

```java
// Managed channel adapter: carrier API with circuit breaker, retries, and monitoring
from("kafka:eip.shipping.scheduled?brokers=localhost:9092&groupId=carrier-adapter")
    .routeId("managed-adapter-carrier")
    .unmarshal().json(Map.class)
    .wireTap("direct:adapter-metrics")
    .circuitBreaker()
        .resilience4jConfiguration()
            .slidingWindowSize(10)
            .failureRateThreshold(50)
            .waitDurationInOpenState(30)
        .end()
        .log("Calling carrier API for shipment ${body[shipment_id]}")
        .marshal().json()
        .to("http://carrier-api.example.com/shipments"
            + "?httpMethod=POST&connectTimeout=5000&socketTimeout=30000")
        .unmarshal().json(Map.class)
        .log("Carrier confirmed: ${body[tracking_number]}")
    .onFallback()
        .log("Circuit OPEN: carrier API unavailable, routing to DLQ")
        .marshal().json()
        .to("kafka:eip.shipping.carrier-failures?brokers=localhost:9092")
    .end()
    .wireTap("direct:adapter-metrics");

// Adapter health metrics
from("direct:adapter-metrics")
    .routeId("adapter-metrics")
    .to("micrometer:counter:adapter.calls?tags=adapter=carrier-api")
    .choice()
        .when(header("CamelCircuitBreakerState").isNotNull())
            .to("micrometer:counter:adapter.circuit?tags=state=${header.CamelCircuitBreakerState}")
    .end();
```

## Common pitfalls

**Test messages that trigger side effects.** If test orders are processed by payment-service and actually charge a credit card, your synthetic health check just cost someone $99.99. All business routes must filter on the `isTestMessage` header or `test_message` body field before executing side effects.

**Detours without logging.** If you enable a detour and forget about it, the enrichment step stays bypassed indefinitely. Log every detour activation and set up alerts when detour flags are active for more than a configured duration.

**Smart proxies that drift from the real API.** If the mock mode returns `{"status": "AUTHORIZED"}` but the real gateway returns `{"status": "authorized"}` (different casing), tests pass but production breaks. Regularly validate mock responses against the real API's contract.

**Managing adapters without alerting.** A circuit breaker that silently routes to the DLQ doesn't help if nobody notices. Combine circuit breaker state changes with alerting (PagerDuty, Slack, email) so the operations team can investigate.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 10: "System Management"
- [enterpriseintegrationpatterns.com — Test Message](https://www.enterpriseintegrationpatterns.com/patterns/messaging/TestMessage.html)
- [enterpriseintegrationpatterns.com — Detour](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Detour.html)
- [enterpriseintegrationpatterns.com — Smart Proxy](https://www.enterpriseintegrationpatterns.com/patterns/messaging/SmartProxy.html)
- [Apache Camel — Testing](https://camel.apache.org/manual/testing.html)
- [Apache Camel — Circuit Breaker](https://camel.apache.org/components/4.20.x/eips/circuitBreaker-eip.html)
- [Quarkus — Configuration Reference](https://quarkus.io/guides/config-reference)

## What you learned

- **Test Message** injects synthetic known-result messages to continuously verify system health — filter them out of business processing with a header flag.
- **Detour** conditionally bypasses processing steps at runtime — controlled by configuration properties or feature flags for zero-downtime debugging.
- **Smart Proxy** routes to different backends based on environment — mock for development, sandbox for staging, production for live traffic.
- **Channel Adapter Management** combines circuit breakers, dead letter channels, and monitoring to handle external system failures gracefully.

This completes Part 8 — System Management (8 patterns across 2 chapters) — and the entire EIP pattern catalog. All 65 Enterprise Integration Patterns have been covered across Parts 1-8. Next: Part 9 — Deep-Dive Appendices, covering advanced topics like schema evolution, testing strategies, performance tuning, and production deployment.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Quarkus property placeholders `{% raw %}{{property:default}}{% endraw %}` work in Simple expressions; Quarkus profiles `%dev.`/`%staging.` override properties correctly; `circuitBreaker()` with `resilience4jConfiguration()` builder syntax is valid in Camel 4.20; `MockEndpoint` and `@EndpointInject` exist in `camel-quarkus-junit5`; `timer` component `period` is in milliseconds.*
