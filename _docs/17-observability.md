---
title: "Observability"
order: 17
part: system-management
description: "Control Bus, Message Store, Message History, and Wire Tap (for monitoring) — patterns that make a running integration system observable."
duration: "40 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/17-observability/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/17-observability) with subdirectories for each runtime.

{% include codetabs.html langs="Quarkus|Spring Boot|YAML DSL" %}

```bash
# Quarkus
cd examples/17-observability/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/17-observability/spring-boot
mvn spring-boot:run
```

```bash
# YAML DSL (Camel CLI)
cd examples/17-observability/yaml-dsl
camel run *
```

A messaging system that you can't observe is a messaging system you can't troubleshoot. When order 42 goes missing somewhere between inventory-service and payment-service, you need to answer: *Did the message arrive? Where did it go? What happened to it? How long did each step take?*

{% include excalidraw.html file="17-control-bus" alt="Control Bus for route management" caption="Figure 17.1 — The Control Bus manages routes at runtime and exports metrics to observability tools." %}

System Management patterns address operational concerns: monitoring, debugging, testing, and managing a running integration system. This chapter covers four observability patterns. The next chapter covers management and testing patterns.

## Pattern: Control Bus

### The problem

You have 15 Camel routes running across 5 services. During a deployment, you need to pause the order-intake route while the database migration runs, then resume it. During a flash sale, you want to increase the consumer thread count on the inventory route. At 3 AM, you want to check whether all routes are healthy.

These are operational tasks — not business logic changes, but runtime configuration and control of the messaging system.

### The solution

A **Control Bus** provides a mechanism to monitor and manage the integration system at runtime. It's a dedicated channel (or API) for system commands: start/stop routes, query status, adjust configuration, trigger health checks.

### How Camel models it

Camel provides a comprehensive Control Bus through multiple mechanisms:

**1. The `controlbus` component — manage routes from within Camel:**

```java
// Control Bus: manage routes via messaging
from("kafka:eip.system.control?brokers=localhost:9092&groupId=control-bus")
    .routeId("control-bus")
    .unmarshal().json(Map.class)
    .log("Control command: ${body[action]} on route ${body[routeId]}")
    .choice()
        .when(simple("${body[action]} == 'stop'"))
            .toD("controlbus:route?routeId=${body[routeId]}&action=stop")
            .log("Route ${body[routeId]} stopped")
        .when(simple("${body[action]} == 'start'"))
            .toD("controlbus:route?routeId=${body[routeId]}&action=start")
            .log("Route ${body[routeId]} started")
        .when(simple("${body[action]} == 'status'"))
            .toD("controlbus:route?routeId=${body[routeId]}&action=status")
            .log("Route ${body[routeId]} status: ${body}")
    .end();

// Expose route status via REST for monitoring
rest("/api/routes")
    .get("/{routeId}/status")
    .to("direct:route-status");

from("direct:route-status")
    .routeId("route-status-api")
    .toD("controlbus:route?routeId=${header.routeId}&action=status");
```

**2. JBang and `camel` CLI — the developer's control bus:**

During development, `camel` CLI commands are the control bus:

```bash
# List all running routes and their status
camel get route

# Stop a specific route
camel cmd stop-route --id order-intake

# Start a route
camel cmd start-route --id order-intake

# View route statistics (message count, failures, processing time)
camel get route --stat

# Real-time resource monitoring
camel top

# Trace message flow through routes
camel trace content-based-router
```

These commands connect to the running Camel context via a local management API. In production, the same capabilities are available through:
- **JMX** — Camel exposes MBeans for every route, component, and processor.
- **REST management API** — Quarkus exposes health and metrics endpoints.
- **Micrometer** — Route-level metrics exported to Prometheus.

**3. Quarkus health checks — Kubernetes-native control bus:**

Camel Quarkus automatically registers health checks for every route:

```java
// application.properties
// camel.health.routes-enabled = true
// camel.health.consumers-enabled = true
```

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
// Quarkus — CDI discovers the health check via @ApplicationScoped
@ApplicationScoped
@Readiness
public class KafkaHealthCheck implements HealthCheck {
```

```java
// Spring Boot — Spring discovers the health check via @Component
@Component
public class KafkaHealthCheck implements HealthCheck {
```

```java
    @Override
    public HealthCheckResponse call() {
        // Check Kafka connectivity
        return HealthCheckResponse.up("kafka");
    }
}
```

Kubernetes uses these for liveness and readiness probes:

## Pattern: Message Store

### The problem

When debugging a production issue — "order 42 was placed but never shipped" — you need to see every message that mentioned order 42: the `OrderPlaced` event, the `InventoryReserved` confirmation, the `PaymentProcessed` result, and the conspicuously absent `ShipmentScheduled` event. You need a searchable log of all messages that have flowed through the system.

### The solution

A **Message Store** captures and persists messages as they flow through the system. It serves as an audit trail, a debugging tool, and (if needed) a replay source. The store captures the message at one or more points in the route — typically at ingress and egress points.

### How Camel models it

```java
// Message Store: capture every message flowing through the order pipeline
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("message-store-example")
    .unmarshal().json(Map.class)
    // Store the incoming message
    .wireTap("direct:store-message")
    // Process normally
    .to("direct:check-inventory")
    // Store the outgoing message
    .wireTap("direct:store-message");

from("direct:store-message")
    .routeId("message-store")
    .process(exchange -> {
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        Map<String, Object> record = new java.util.LinkedHashMap<>();
        record.put("message_id", exchange.getExchangeId());
        record.put("route_id", exchange.getFromRouteId());
        record.put("timestamp", java.time.Instant.now().toString());
        record.put("body", body);
        record.put("headers", new java.util.LinkedHashMap<>(exchange.getIn().getHeaders()));
        exchange.getIn().setBody(record);
    })
    .marshal().json()
    .to("sql:INSERT INTO system.message_store "
        + "(message_id, route_id, timestamp, payload) "
        + "VALUES (:#${body[message_id]}, :#${body[route_id]}, "
        + ":#${body[timestamp]}, :#${body[payload]})"
        + "?dataSource=#systemDataSource");
```

### Kafka as a message store

Kafka itself is a message store — it retains all messages for the configured retention period (default 7 days). You can replay any consumer group by resetting its offset. For many use cases, Kafka's built-in retention replaces the need for a separate message store.

But a dedicated message store adds:
- **Cross-topic search** — Query all messages for order 42 across all topics.
- **Long-term retention** — Keep messages beyond Kafka's retention period.
- **Structured queries** — SQL queries, time-range searches, header-based filtering.
- **PII-redacted copies** — Store messages with sensitive fields stripped.

## Pattern: Message History

### The problem

Order 42's `ShipmentScheduled` event is missing. You know it entered the routing pipeline, but somewhere between the content-based router, the hazmat check, and the fulfillment dispatch, it vanished. You need to trace the exact path the message took through the system.

### The solution

A **Message History** records the sequence of processing steps a message has passed through. Each step appends an entry to the history — like a flight itinerary or a shipping tracking number. When you inspect the message at any point, you can see exactly where it's been.

### How Camel models it

Camel has built-in message history support. Enable it and every exchange carries a history of all processing steps:

```java
// Enable message history (enabled by default in Camel 4.x)
// In application.properties:
//   camel.context.message-history = true

// Access the history at any point
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=history-demo")
    .routeId("message-history-demo")
    .unmarshal().json(Map.class)
    .to("direct:validate")
    .to("direct:check-inventory")
    .to("direct:process-payment")
    .process(exchange -> {
        // Inspect the message history
        List<MessageHistory> history = exchange.getProperty(
            Exchange.MESSAGE_HISTORY, List.class);
        if (history != null) {
            for (MessageHistory entry : history) {
                System.out.printf("Step: %s [%s] at %s (elapsed: %dms)%n",
                    entry.getRouteId(),
                    entry.getNode().getLabel(),
                    entry.getTime(),
                    entry.getElapsed());
            }
        }
    })
    .log("Processing complete for order ${body[order_id]}");
```

### Message history and distributed tracing

For a single Camel application, the built-in message history is sufficient. But in a microservices architecture, the message passes through *multiple* applications — order-service → inventory-service → payment-service → shipping-service. The per-application history doesn't span services.

**OpenTelemetry** provides cross-service message history. Camel Quarkus integrates with OpenTelemetry to propagate trace IDs across Kafka messages:

```properties
# application.properties — enable OpenTelemetry tracing
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
quarkus.otel.service.name=order-service

# Camel automatically propagates trace context through Kafka headers
camel.component.kafka.additional-properties.interceptor.classes=\
  io.opentelemetry.instrumentation.kafkaclients.TracingProducerInterceptor,\
  io.opentelemetry.instrumentation.kafkaclients.TracingConsumerInterceptor
```

With OpenTelemetry configured and the LGTM stack running (Part 0), you can:
1. Search Grafana/Tempo for a trace ID.
2. See the complete path: HTTP request → order-service → Kafka → inventory-service → Kafka → payment-service → Kafka → shipping-service.
3. See timing for each span — how long each service took, where bottlenecks are.

This is the distributed Message History — and it's one of the most valuable debugging tools in a microservices architecture.

### `camel trace` as a live message history

During development with JBang, `camel trace` provides real-time message history:

```bash
# Start the route
camel run order-pipeline.yaml --dev

# In another terminal, trace the route
camel trace order-pipeline

# Output shows each step, timing, and the exchange state:
#   1. kafka:eip.orders.placed → unmarshal(json)  [2ms]
#   2. unmarshal(json) → direct:validate           [0ms]
#   3. direct:validate → direct:check-inventory    [45ms]
#   4. direct:check-inventory → direct:process-pay [120ms]
```

## Pattern: Wire Tap (for monitoring)

### The problem

You want to collect metrics on every order that flows through the system: order volume per hour, average processing time, error rate by route, top destinations by country. But you don't want to modify the business routes — metrics collection is a cross-cutting concern.

### The solution

We covered the **Wire Tap** in Chapter 11 as a routing pattern. Here, we use it as a system management pattern — tapping into the message flow to collect metrics and feed monitoring dashboards without affecting the business routes.

### How Camel models it

```java
// Metrics wire tap: collect metrics without affecting the main flow
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=order-processing")
    .routeId("metrics-wire-tap")
    .unmarshal().json(Map.class)
    // Tap for metrics — async, non-blocking
    .wireTap("direct:collect-metrics")
    // Main processing continues
    .to("direct:process-order");

from("direct:collect-metrics")
    .routeId("metrics-collector")
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        String country = (String) order.getOrDefault("destination_country", "UNKNOWN");
        String priority = (String) order.getOrDefault("shipping_priority", "STANDARD");
        exchange.getIn().setHeader("country", country);
        exchange.getIn().setHeader("priority", priority);
    })
    // Micrometer counters and timers
    .to("micrometer:counter:orders.received"
        + "?tags=country=${header.country},priority=${header.priority}")
    .to("micrometer:counter:orders.amount.total"
        + "?tags=country=${header.country}"
        + "&increment=${body[amount]}");
```

### The three pillars in our stack

Our LGTM observability stack (optional compose overlay from Part 0) provides all three observability pillars:

| Pillar | Tool | Camel Integration |
|--------|------|-------------------|
| **Metrics** | Mimir (Prometheus-compatible) | `camel-micrometer` component + Quarkus Micrometer |
| **Logs** | Loki | Structured JSON logging via Quarkus logging |
| **Traces** | Tempo | `camel-opentelemetry` + Quarkus OpenTelemetry |

Wire taps feed the metrics pillar. OpenTelemetry feeds traces. Structured logging feeds Loki. Together, they give you full observability over the entire message flow.

## Common pitfalls

**Control bus without authentication.** A `kafka:eip.system.control` topic that accepts route stop/start commands from anyone is a denial-of-service vulnerability. Authenticate and authorize control bus messages — or restrict control to JMX/REST endpoints behind a service mesh.

**Message store with PII.** A message store that captures everything — including customer emails, credit card numbers, and addresses — is a data governance nightmare. Apply content filters before storing, or use a separate PII-safe schema.

**Message history in high-throughput routes.** Camel's message history adds overhead per step (object allocation, timestamp capture). For routes processing millions of messages per second, disable it (`camel.context.message-history=false`) and rely on sampled tracing instead.

**Metrics with high-cardinality tags.** Using `order_id` or `customer_id` as a Prometheus tag creates millions of time series and overwhelms the metrics backend. Use low-cardinality tags: country, priority, status, route ID.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 10: "System Management"
- [enterpriseintegrationpatterns.com — Control Bus](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ControlBus.html)
- [enterpriseintegrationpatterns.com — Message Store](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageStore.html)
- [enterpriseintegrationpatterns.com — Message History](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageHistory.html)
- [enterpriseintegrationpatterns.com — Wire Tap](https://www.enterpriseintegrationpatterns.com/patterns/messaging/WireTap.html)
- [Apache Camel — Control Bus Component](https://camel.apache.org/components/4.20.x/controlbus-component.html)
- [Apache Camel — Message History](https://camel.apache.org/manual/message-history.html)
- [Apache Camel — OpenTelemetry](https://camel.apache.org/components/4.20.x/others/opentelemetry.html)

## What you learned

- **Control Bus** provides runtime management of routes and components — use `camel` CLI for development, JMX/REST for production, and Quarkus health checks for Kubernetes.
- **Message Store** captures messages for auditing, debugging, and replay — use wire taps to store asynchronously, and consider Kafka's built-in retention as a basic store.
- **Message History** records the path a message takes through the system — built into Camel, extended across services by OpenTelemetry distributed tracing.
- **Wire Tap (for monitoring)** feeds metrics without affecting business routes — use Micrometer counters with low-cardinality tags for Prometheus-compatible dashboards.

Next: testing and management patterns — Test Message, Detour, Smart Proxy, and Channel Adapter management.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0. YAML DSL routes provided for Camel CLI.*
