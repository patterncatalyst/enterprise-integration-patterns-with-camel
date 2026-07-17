---
title: "Appendix I: Observability Stack"
order: 27
part: appendices
description: "OpenTelemetry instrumentation, Grafana dashboards, distributed tracing through Camel routes, and the LGTM stack."
duration: "25 minutes"
---

Chapter 17 introduced the observability patterns — Control Bus, Message Store, Message History, and monitoring Wire Taps. This appendix goes deeper into the implementation: how to instrument Camel routes with OpenTelemetry, build Grafana dashboards, and trace messages across services.

The code is in `examples/27-observability-stack/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/27-observability-stack/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/27-observability-stack/spring-boot
mvn spring-boot:run
```

{% include excalidraw.html file="27-appendix-observability" alt="LGTM observability stack: Camel services to OTel Collector to Loki, Tempo, Mimir, and Grafana" caption="Figure I.1 — The LGTM observability pipeline: Camel services emit traces, metrics, and logs via OpenTelemetry to the OTel Collector, which fans out to Loki, Tempo, and Mimir for Grafana visualization." %}

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

{% include excalidraw.html file="27-trace-tree" alt="Distributed trace showing spans across order-service and inventory-service, linked via Kafka header propagation" caption="Figure I.1 — Distributed trace: the produce span in order-service and the consume span in inventory-service are linked under the same trace ID via Kafka header propagation." %}

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

*Verification status: <span class="status status--verified">verified</span> against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
