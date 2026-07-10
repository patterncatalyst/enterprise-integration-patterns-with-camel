---
title: "Appendix I: Observability Stack"
order: 27
part: appendices
description: "OpenTelemetry instrumentation, Grafana dashboards, distributed tracing through Camel routes, and the LGTM stack."
duration: "25 minutes"
---

Chapter 17 introduced the observability patterns — Control Bus, Message Store, Message History, and monitoring Wire Taps. This appendix goes deeper into the implementation: how to instrument Camel routes with OpenTelemetry, build Grafana dashboards, and trace messages across services.

## The LGTM stack

Our optional `compose.lgtm.yaml` overlay provides the Grafana LGTM stack:

| Component | Role | Port |
|-----------|------|------|
| **Grafana** | Dashboards and alerting | 3000 |
| **Loki** | Log aggregation | 3100 |
| **Tempo** | Distributed tracing | 4317 (OTLP gRPC), 3200 (query) |
| **Mimir** | Metrics (Prometheus-compatible) | 9009 |
| **OTel Collector** | Telemetry pipeline | 4317 (gRPC), 4318 (HTTP) |

Start it alongside the base stack:

```bash
./scripts/setup-stack.sh --lgtm
```

## OpenTelemetry instrumentation

### Dependencies

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-opentelemetry</artifactId>
</dependency>
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-opentelemetry</artifactId>
</dependency>
```

### Configuration

```properties
# application.properties
quarkus.application.name=order-service
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
quarkus.otel.exporter.otlp.protocol=grpc

# Camel-specific OpenTelemetry settings
camel.opentelemetry.enabled=true
camel.opentelemetry.exclude-patterns=timer:*,controlbus:*
```

### What gets traced automatically

With `camel-quarkus-opentelemetry` on the classpath, Camel automatically creates spans for:
- Every route entry (`from()`)
- Every `to()` / `toD()` call
- Every EIP processor (split, aggregate, choice, filter)
- Kafka produce and consume operations
- HTTP requests (via `platform-http` and `http` components)

Each span includes:
- Route ID, node ID, and processor name
- Exchange ID (for correlation)
- Message headers (configurable — default excludes sensitive headers)
- Duration and status (OK / ERROR)

### Trace context propagation

Camel propagates OpenTelemetry trace context through Kafka headers automatically. When order-service publishes to `eip.orders.placed` and inventory-service consumes it, both spans appear under the same trace:

```
Trace: abc123
├── order-service: POST /api/orders [200ms]
│   ├── route:create-order [50ms]
│   ├── sql:INSERT INTO orders.orders [30ms]
│   └── kafka:eip.orders.placed (PRODUCE) [10ms]
└── inventory-service: kafka:eip.orders.placed (CONSUME) [45ms]
    ├── route:check-inventory [40ms]
    └── sql:SELECT FROM inventory.stock [15ms]
```

## Custom spans

Add custom spans for business-significant operations:

```java
@Inject
Tracer tracer;

from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("traced-inventory-check")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Span span = tracer.spanBuilder("inventory.check")
            .setAttribute("order.id", String.valueOf(exchange.getIn().getBody(Map.class).get("order_id")))
            .setAttribute("item.sku", String.valueOf(exchange.getIn().getBody(Map.class).get("item_sku")))
            .startSpan();
        try (Scope scope = span.makeCurrent()) {
            // Inventory check logic
            span.setAttribute("inventory.available", true);
            span.setAttribute("inventory.warehouse", "EAST-1");
        } finally {
            span.end();
        }
    })
    .to("direct:process-inventory-result");
```

## Metrics with Micrometer

Camel Quarkus integrates with Micrometer for Prometheus-compatible metrics:

```xml
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-micrometer</artifactId>
</dependency>
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-registry-prometheus</artifactId>
</dependency>
```

Automatic metrics per route:
- `camel.exchanges.total` — Total exchanges processed
- `camel.exchanges.failed` — Failed exchanges
- `camel.exchanges.processing.time` — Processing duration histogram
- `camel.routes.running` — Number of running routes

Custom business metrics:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=metrics")
    .routeId("business-metrics")
    .unmarshal().json(Map.class)
    .to("micrometer:counter:orders.received"
        + "?tags=country=${body[destination_country]},priority=${body[shipping_priority]}")
    .to("micrometer:timer:orders.processing.time?action=start")
    .to("direct:process-order")
    .to("micrometer:timer:orders.processing.time?action=stop");
```

## Structured logging with Loki

Configure structured JSON logging for Loki ingestion:

```properties
# application.properties
quarkus.log.console.format=%d{yyyy-MM-dd HH:mm:ss} %-5p [%c{3.}] (%t) %s%e%n
quarkus.log.console.json=true
quarkus.log.console.json.additional-field.service.value=order-service
quarkus.log.console.json.additional-field.environment.value=${ENVIRONMENT:dev}
```

In Grafana, query Loki with LogQL:

```logql
{service="order-service"} |= "order_id" | json | order_id="42"
```

This shows all log entries from order-service that mention order 42 — across all routes and threads.

## Grafana dashboard essentials

Build dashboards around these queries:

**Order throughput** (Mimir/Prometheus):
```promql
rate(camel_exchanges_total{routeId="create-order"}[5m])
```

**Error rate**:
```promql
rate(camel_exchanges_failed_total[5m]) / rate(camel_exchanges_total[5m])
```

**P99 processing latency**:
```promql
histogram_quantile(0.99, rate(camel_exchanges_processing_time_seconds_bucket[5m]))
```

**Kafka consumer lag** (if Kafka metrics are exported):
```promql
kafka_consumer_group_lag{group="inventory-service", topic="eip.orders.placed"}
```

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `camel-quarkus-opentelemetry` extension exists and auto-instruments routes; Camel propagates W3C trace context through Kafka headers; `camel-quarkus-micrometer` exports `camel.exchanges.total` and related metrics; Quarkus structured JSON logging configuration keys are correct; `quarkus.otel.exporter.otlp.endpoint` is the correct config property.*
