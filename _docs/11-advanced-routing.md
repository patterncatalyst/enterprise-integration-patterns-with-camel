---
title: "Advanced Routing"
order: 11
part: message-routing
description: "Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, and Load Balancer — patterns for runtime-adaptive, observable, and resilient routing."
duration: "40 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/11-advanced-routing/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/11-advanced-routing) — run it with `mvn quarkus:dev` against the local stack.

The previous two chapters covered the most common routing patterns. This chapter rounds out the routing catalog with five patterns that address specific challenges: routing decisions that change at runtime, observability without disrupting the flow, reordering out-of-sequence messages, processing composite messages efficiently, and distributing load across multiple processing nodes.

{% include excalidraw.html file="11-wire-tap" alt="Wire Tap pattern" caption="Figure 11.1 — Wire Tap sends a copy of the message to a monitoring channel without affecting the main flow." %}

## Pattern: Dynamic Router

### The problem

The routing slip pattern determines the full sequence of steps upfront. But some workflows can't be planned in advance — the next step depends on the result of the current step, and the decision logic changes frequently. For example:

- A/B testing routes: 10% of orders go through a new experimental fulfillment path, 90% through the standard path. The split changes weekly.
- Rule-engine routing: a business rules engine decides the next step based on the current order state, customer profile, and external data. New rules are deployed without code changes.
- Feature-flagged flows: a new customs processing step is rolled out gradually via feature flags.

You need a router where the routing decision is computed *fresh at each step*, not locked in at the start.

### The solution

A **Dynamic Router** is called repeatedly for each message, and it makes the routing decision fresh each time. After the message is processed by the current step, it comes back to the dynamic router, which decides the next step (or declares routing complete). The key difference from a routing slip: the dynamic router sees the message's *current state* (including modifications from the previous step) and makes an informed decision.

### How Camel models it

Camel's `dynamicRouter()` EIP calls a method repeatedly. The method returns the next endpoint, or `null` to stop:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=dynamic-routing")
    .routeId("dynamic-router")
    .unmarshal().json(Map.class)
    .dynamicRouter(method(OrderRoutingBean.class, "route"));

// The bean is called repeatedly until it returns null
@ApplicationScoped
@Named("orderRoutingBean")
public class OrderRoutingBean {

    public String route(@Body Map<String, Object> order,
                        @ExchangeProperties Map<String, Object> properties) {
        // Track which step we're on
        int step = (int) properties.getOrDefault("routingStep", 0);
        properties.put("routingStep", step + 1);

        return switch (step) {
            case 0 -> "direct:validate";
            case 1 -> {
                // Dynamic decision based on validation result
                Boolean valid = (Boolean) properties.get("validated");
                yield valid ? "direct:check-inventory" : "direct:reject-order";
            }
            case 2 -> {
                Boolean inStock = (Boolean) properties.get("inStock");
                if (!inStock) yield "direct:backorder";
                double amount = ((Number) order.get("amount")).doubleValue();
                yield amount >= 10000 ? "direct:fraud-review" : "direct:process-payment";
            }
            case 3 -> {
                Boolean fraudCleared = (Boolean) properties.getOrDefault("fraudCleared", true);
                yield fraudCleared ? "direct:schedule-shipping" : "direct:cancel-order";
            }
            default -> null; // Stop routing
        };
    }
}
```

### Dynamic router vs. routing slip

| Dimension | Dynamic Router | Routing Slip |
|-----------|---------------|-------------|
| **Decision timing** | At each step, based on current state | Upfront, before processing starts |
| **Adaptability** | Fully adaptive — can change course mid-flow | Fixed — the slip is set at the start |
| **Complexity** | Higher — routing logic runs repeatedly | Lower — just follow the list |
| **Use case** | Conditional workflows, A/B testing, rule engines | Known multi-step pipelines |

### The "return null to stop" contract

The dynamic router method **must** return `null` to stop routing. If it always returns an endpoint, the router loops forever. This is the most common mistake with dynamic routers — forgetting to terminate. Always include a default case that returns `null`.

## Pattern: Wire Tap

### The problem

You want to log, audit, or monitor every order that passes through the system — but you don't want to slow down the main processing flow. Adding a synchronous `.to("kafka:eip.audit.orders")` in the middle of the route means the main flow waits for Kafka to acknowledge the audit message. If the audit system is slow or down, it blocks order processing.

### The solution

A **Wire Tap** sends a copy of the message to a secondary channel without affecting the main flow. The main route continues immediately; the tap processes asynchronously. Think of it as a network packet capture — it observes the traffic without interfering.

### How Camel models it

Camel's `wireTap()` EIP sends a copy of the exchange to another endpoint in a separate thread:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=order-processor")
    .routeId("wire-tap")
    .unmarshal().json(Map.class)
    // Wire tap: send a copy to the audit stream without blocking
    .wireTap("kafka:eip.audit.orders?brokers=localhost:9092")
    // Wire tap: send a copy to the analytics stream
    .wireTap("direct:analytics-enrichment")
    // Main flow continues immediately — not affected by taps
    .log("Processing order ${body[order_id]}")
    .to("direct:process-order");

// The analytics tap can modify its copy without affecting the main flow
from("direct:analytics-enrichment")
    .routeId("analytics-tap")
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        order.put("analytics_timestamp", java.time.Instant.now().toString());
        order.put("analytics_source", "wire-tap");
    })
    .marshal().json()
    .to("kafka:eip.analytics.orders?brokers=localhost:9092");
```

### Wire tap vs. multicast

| Dimension | Wire Tap | Multicast |
|-----------|----------|-----------|
| **Blocking** | No — async, fire-and-forget | Yes — waits for all recipients |
| **Copy** | Shallow copy of the exchange | Full copy |
| **Failure impact** | Tap failure doesn't affect main flow | Recipient failure can affect the flow |
| **Use case** | Auditing, logging, analytics, monitoring | Sending to multiple recipients that matter |

Use wire tap when the secondary processing is optional and shouldn't slow down or block the primary flow. Use multicast when all recipients must process the message.

### Wire tap with a modified copy

By default, the wire tap sends a copy of the current exchange. You can modify the copy before sending with `onPrepare()`:

```java
.wireTap("kafka:eip.audit.orders?brokers=localhost:9092")
    .onPrepare(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        // Redact sensitive fields before auditing
        Map<String, Object> redacted = new java.util.LinkedHashMap<>(order);
        redacted.put("customer_email", "***@***.com");
        redacted.put("payment_card", "****-****-****-" + order.get("card_last_four"));
        exchange.getIn().setBody(redacted);
    })
```

This is useful for audit streams where you need to redact PII before logging.

## Pattern: Resequencer

### The problem

Kafka guarantees ordering within a partition, but if order updates arrive on different partitions (or from different producers), they can arrive out of order. Order 42 might have updates: `PLACED` (10:00:01), `RESERVED` (10:00:03), `PAID` (10:00:05). But due to partition assignment, the consumer might see them as `RESERVED`, `PLACED`, `PAID`.

A status dashboard that shows these updates needs them in chronological order. A state machine that transitions `PLACED → RESERVED → PAID` can't handle `RESERVED` arriving before `PLACED`.

### The solution

A **Resequencer** collects messages from a stream and re-emits them in the correct order based on a sequence key (timestamp, sequence number, etc.). It acts as a buffer that absorbs out-of-order arrivals and releases them in order.

Camel offers two resequencer modes:
- **Batch** — Collect N messages, sort them, emit in order. Simple but introduces latency.
- **Stream** — Emit messages as soon as the next expected sequence number arrives. Lower latency but more complex.

### How Camel models it

```java
// Batch resequencer: collect, sort, emit
from("kafka:eip.orders.status-updates?brokers=localhost:9092&groupId=resequencer")
    .routeId("resequencer-batch")
    .unmarshal().json(Map.class)
    .resequence(simple("${body[event_time]}"))
        .batch()
        .size(50)
        .timeout(5000)
    .log("Ordered update: ${body[order_id]} → ${body[status]} at ${body[event_time]}")
    .to("direct:update-dashboard");

// Stream resequencer: emit as soon as the next expected sequence arrives
from("kafka:eip.orders.sequenced-updates?brokers=localhost:9092&groupId=stream-reseq")
    .routeId("resequencer-stream")
    .unmarshal().json(Map.class)
    .resequence(header("sequenceNumber"))
        .stream()
        .timeout(10000)
        .capacity(200)
    .log("Emitting in order: sequence ${header.sequenceNumber}")
    .to("direct:process-in-order");
```

### When ordering already works

Before adding a resequencer, check if you can fix the ordering upstream:
- **Same Kafka partition** — If all events for an order use the same key (order ID), they're guaranteed to arrive in order within a partition. Use `key=${header.orderId}` on the producer.
- **Single partition** — If total ordering matters more than throughput, use a single-partition topic. But this limits throughput to one consumer.
- **Pulsar exclusive subscription** — With an exclusive subscription on a single-partition topic, ordering is guaranteed.

Only add a resequencer when you can't control the upstream ordering — for example, when aggregating events from multiple independent producers or bridging between different messaging systems.

## Pattern: Composed Message Processor

### The problem

A purchase order contains multiple line items, each requiring independent processing (inventory check, pricing, warehouse assignment). But after processing each item, you need to reassemble the complete order with the results. You need to split, process individually, and then merge back together.

### The solution

A **Composed Message Processor** (also called Splitter-Aggregator) is the combination of:
1. A **Splitter** that breaks the composite message into parts.
2. Independent **processing** of each part.
3. An **Aggregator** that reassembles the parts into a single result.

### How Camel models it

Camel's `split()` with an `aggregationStrategy` handles this in one fluent chain:

```java
from("kafka:eip.orders.bulk?brokers=localhost:9092&groupId=composed-processor")
    .routeId("composed-message-processor")
    .unmarshal().json(Map.class)
    .split(jsonpath("$.line_items"), new OrderItemAggregation())
        .parallelProcessing()
        // Each item is processed independently
        .to("direct:check-item-inventory")
        .to("direct:calculate-item-price")
        .to("direct:assign-warehouse")
    .end()
    // After split/aggregate: body is the reassembled order
    .log("Processed order with ${body[item_count]} items, total: $${body[total]}")
    .marshal().json()
    .to("kafka:eip.orders.processed?brokers=localhost:9092");
```

The aggregation strategy reassembles the processed items:

```java
public class OrderItemAggregation implements AggregationStrategy {
    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        Map<String, Object> item = newExchange.getIn().getBody(Map.class);
        if (oldExchange == null) {
            Map<String, Object> result = new java.util.LinkedHashMap<>();
            result.put("items", new java.util.ArrayList<>(List.of(item)));
            result.put("total", ((Number) item.get("price")).doubleValue());
            result.put("item_count", 1);
            newExchange.getIn().setBody(result);
            return newExchange;
        }
        Map<String, Object> result = oldExchange.getIn().getBody(Map.class);
        ((List<Object>) result.get("items")).add(item);
        result.put("total", ((Number) result.get("total")).doubleValue()
            + ((Number) item.get("price")).doubleValue());
        result.put("item_count", ((Number) result.get("item_count")).intValue() + 1);
        return oldExchange;
    }
}
```

## Pattern: Load Balancer

### The problem

Payment-service runs on three instances. When processing payments, you want to distribute the load evenly across instances — and if one instance is unhealthy, stop sending it traffic until it recovers.

In a Kafka architecture, load balancing happens naturally through consumer group partition assignment. But for synchronous processing (HTTP endpoints, direct calls), you need explicit load balancing.

### The solution

A **Load Balancer** distributes messages across multiple processing nodes using a strategy:
- **Round-robin** — Cycle through endpoints in order.
- **Random** — Pick a random endpoint.
- **Sticky** — Route by a key (like customer ID) so the same customer always hits the same instance.
- **Failover** — Try the first endpoint; if it fails, try the next.
- **Circuit breaker** — Track failures per endpoint and temporarily disable unhealthy ones.

### How Camel models it

```java
// Round-robin across payment service instances
from("direct:process-payment")
    .routeId("load-balancer-round-robin")
    .loadBalance().roundRobin()
        .to("http://payment-1:8080/charge")
        .to("http://payment-2:8080/charge")
        .to("http://payment-3:8080/charge")
    .end();

// Failover: try each endpoint in order until one succeeds
from("direct:process-payment-failover")
    .routeId("load-balancer-failover")
    .loadBalance().failover(3, false, true,
            java.net.ConnectException.class,
            org.apache.camel.http.base.HttpOperationFailedException.class)
        .to("http://payment-1:8080/charge")
        .to("http://payment-2:8080/charge")
        .to("http://payment-3:8080/charge")
    .end();

// Sticky: same customer always routes to the same instance
from("direct:process-payment-sticky")
    .routeId("load-balancer-sticky")
    .loadBalance().sticky(header("customerId"))
        .to("http://payment-1:8080/charge")
        .to("http://payment-2:8080/charge")
        .to("http://payment-3:8080/charge")
    .end();
```

### Load balancer vs. Kafka consumer groups

In our Kafka-centric architecture, Kafka's consumer group protocol provides load balancing for Kafka messages automatically — no Camel `loadBalance()` needed. Use Camel's load balancer for:
- **HTTP calls** to services without a load balancer (no Kubernetes service, no Nginx).
- **Direct calls** within a single application where you want to distribute across internal processors.
- **Failover** across multiple instances of an external API.

For Kafka-based workloads, let Kafka handle the distribution through consumer groups.

## Common pitfalls

**Dynamic routers that never terminate.** The dynamic router method must return `null` to stop routing. A bug that always returns an endpoint creates an infinite loop. Add a maximum iteration guard.

**Wire taps that modify the original.** The wire tap sends a *shallow copy* of the exchange. If the tap modifies a mutable object (like a `Map` body), the modification is visible in the main flow. Use `onPrepare()` to create a deep copy if the tap needs to modify the body.

**Resequencers with unbounded buffers.** A stream resequencer holds messages in memory until the expected sequence arrives. If a message is lost (the expected sequence number never arrives), the buffer grows unbounded. Always set `capacity` and `timeout` to bound memory usage.

**Load balancers with stale endpoint lists.** If you hardcode endpoints and an instance moves to a new IP, the load balancer sends traffic to a dead endpoint. Use service discovery (Kubernetes services, Consul, Eureka) to dynamically update the endpoint list.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 7: "Message Routing"
- [enterpriseintegrationpatterns.com — Dynamic Router](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DynamicRouter.html)
- [enterpriseintegrationpatterns.com — Wire Tap](https://www.enterpriseintegrationpatterns.com/patterns/messaging/WireTap.html)
- [enterpriseintegrationpatterns.com — Resequencer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Resequencer.html)
- [enterpriseintegrationpatterns.com — Composed Message Processor](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DistributionAggregate.html)
- [Apache Camel — Dynamic Router EIP](https://camel.apache.org/components/4.20.x/eips/dynamicRouter-eip.html)
- [Apache Camel — Wire Tap EIP](https://camel.apache.org/components/4.20.x/eips/wireTap-eip.html)
- [Apache Camel — Resequencer EIP](https://camel.apache.org/components/4.20.x/eips/resequence-eip.html)
- [Apache Camel — Load Balance EIP](https://camel.apache.org/components/4.20.x/eips/loadBalance-eip.html)

## What you learned

- **Dynamic Router** makes routing decisions at each step based on current state — for workflows that can't be planned upfront.
- **Wire Tap** sends a copy to a secondary channel without blocking the main flow — essential for auditing, analytics, and observability.
- **Resequencer** reorders out-of-sequence messages by a key — batch mode for simple reordering, stream mode for low-latency flows.
- **Composed Message Processor** splits, processes independently, and reassembles — the Splitter-Aggregator combo for composite messages.
- **Load Balancer** distributes messages across processing nodes — round-robin, failover, sticky, and more.

This completes Part 5 — Message Routing (12 patterns across 3 chapters). Next: Part 6 — Message Transformation, where we explore how messages change shape as they flow through the system.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `dynamicRouter()` calls the method repeatedly until it returns `null`; `wireTap()` is asynchronous and supports `onPrepare()`; `resequence()` supports both `batch()` and `stream()` modes with `size`/`timeout`/`capacity` options; `loadBalance()` supports `roundRobin()`, `failover()`, and `sticky()` strategies; `split()` with an `aggregationStrategy` produces the composed message processor pattern.*
