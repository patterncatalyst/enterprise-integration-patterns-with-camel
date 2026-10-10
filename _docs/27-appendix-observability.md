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

| Component | Role | Port on your machine |
|-----------|------|------|
| **Grafana** | Dashboards and alerting | 3000 |
| **Loki** | Log aggregation | 3100 |
| **Tempo** | Distributed tracing | 3200 (query API) |
| **Mimir** | Metrics (Prometheus-compatible) | 9009 |
| **OTel Collector** | Telemetry pipeline | 4317 (gRPC), 4318 (HTTP), 13133 (health) |

Your application never talks to Tempo, Loki or Mimir directly — it sends
everything to the collector on 4317 or 4318, and the collector fans it out.
Tempo does run an OTLP receiver of its own, but only inside the container
network, where the collector reaches it on `tempo:4318`. That is worth knowing
because pointing an exporter at Tempo's 3200 looks plausible, returns no error,
and silently discards every span.

Start it alongside the base stack:

```bash
./scripts/setup-stack.sh --lgtm
```

The script waits on each service's HTTP readiness endpoint from the host rather
than on a container health check. Loki, Mimir and the collector ship distroless
images with no shell and no `wget`, so an in-container probe cannot run in them
at all.

Check it came up:

```bash
curl -s localhost:3000/api/health   # grafana
curl -s localhost:3100/ready        # loki
curl -s localhost:3200/ready        # tempo
curl -s localhost:9009/ready        # mimir
curl -s localhost:13133/            # otel collector
```

## The five-second version

Everything below wires a Maven project into a compose stack you run yourself.
That is what you want for something you are going to deploy. It is a lot of
ceremony when the question is just "what is this route doing right now".

Camel 4.22 added a zero-configuration alternative. `camel infra` ships a bundled
observability stack, and `camel run --observe` points a prototype at it with no
configuration at all:

```bash
camel infra run observability      # Prometheus, VictoriaTraces, VictoriaLogs, Perses
camel run MyRoute.java --observe   # health, metrics, dev console, Camel tracing
```

Metrics get scraped, traces and logs get exported, and none of it needs a
property file.

Two things to be clear about. It is a **different stack** — Prometheus,
VictoriaTraces, VictoriaLogs and Perses, not Loki, Tempo, Mimir and Grafana —
so dashboards and queries are not portable between the two. And it is aimed at
the dev loop, not at the thing you ship. Use it while you are working out what
your routes do; use the rest of this appendix for what runs in production.

If you want auto-instrumentation of the libraries around Camel — JDBC, HTTP
clients, Kafka clients, gRPC — there is also `--open-telemetry-agent`, which
attaches the OpenTelemetry Java Agent and feeds the TUI's Spans tab. See
[Appendix U]({% link _docs/39-appendix-camel-cli.md %}).

## OpenTelemetry instrumentation

### Dependencies

The OpenTelemetry extensions get you *traces*. Metrics and logs need one more
dependency each, and this is the step most people miss — see
[all three signals](#getting-all-three-signals) below for why.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-opentelemetry</artifactId>
</dependency>
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-opentelemetry</artifactId>
</dependency>
<!-- Bridges Micrometer meters and application logs onto the same OTLP
     exporter. Without it only traces leave the application. -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-micrometer-opentelemetry</artifactId>
</dependency>
```

```xml
<dependency>
    <groupId>org.apache.camel.springboot</groupId>
    <artifactId>camel-opentelemetry2-starter</artifactId>
</dependency>
<!-- Autoconfigures the SDK from the otel.* properties and supplies both the
     OTLP exporter and the Logback appender. -->
<dependency>
    <groupId>io.opentelemetry.instrumentation</groupId>
    <artifactId>opentelemetry-spring-boot-starter</artifactId>
</dependency>
<!-- Spring Boot 4 split its OpenTelemetry support into its own module.
     Leave it out and the OTLP metrics autoconfiguration is skipped. -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-opentelemetry</artifactId>
</dependency>
<!-- Carries Micrometer meters, camel_* included, to the collector. -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-otlp</artifactId>
</dependency>
```

Use `camel-opentelemetry2`, not `camel-opentelemetry`. The v1 component is
deprecated as of Camel 4.22 and logs a warning on every boot.

### Configuration

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# application.properties
quarkus.application.name=order-service
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
quarkus.otel.exporter.otlp.protocol=grpc

quarkus.otel.traces.enabled=true
quarkus.otel.metrics.enabled=true
quarkus.otel.logs.enabled=true

# The default is one minute, which is a long time to watch a flat dashboard.
quarkus.otel.metric.export.interval=10s

# Camel-specific OpenTelemetry settings
camel.opentelemetry.enabled=true
camel.opentelemetry.exclude-patterns=timer:*,controlbus:*
```

```properties
# application.properties
spring.application.name=order-service
otel.exporter.otlp.endpoint=http://localhost:4317
otel.exporter.otlp.protocol=grpc
otel.traces.exporter=otlp
otel.logs.exporter=otlp
# Micrometer owns metrics here, so the SDK's own metric exporter stays off.
otel.metrics.exporter=none

camel.opentelemetry2.enabled=true
camel.opentelemetry2.exclude-patterns=timer:*,controlbus:*

# Note this one is 4318, not 4317 — the Micrometer OTLP registry speaks HTTP.
management.otlp.metrics.export.enabled=true
management.otlp.metrics.export.url=http://localhost:4318/v1/metrics
management.otlp.metrics.export.step=10s
# Cumulative is what rate() expects; delta would quietly give you wrong rates.
management.otlp.metrics.export.aggregation-temporality=cumulative
```

### Getting all three signals

A Camel application wired only with the OpenTelemetry extension exports traces
and nothing else. The other two signals fail quietly, and it is worth
understanding why, because the failure looks like success:

- **Metrics.** Camel registers its route meters through Micrometer. The usual
  Micrometer setup is a Prometheus registry, which *exposes* meters at
  `/q/metrics` or `/actuator/prometheus` and waits to be scraped. Nothing in
  this stack scrapes it. The application looks instrumented — 93 `camel_*`
  meters, right there in the browser — while Mimir stays empty. The fix is a
  registry that pushes: the Quarkus `micrometer-opentelemetry` bridge, or
  `micrometer-registry-otlp` on Spring Boot.
- **Logs.** Writing JSON to the console does not put logs in Loki. Something
  has to ship them. Here the OTLP log exporter does it, which also means your
  log records carry the trace and span IDs of whatever route produced them.

On Spring Boot there is one more trap. Camel's tracer looks for a single
`OpenTelemetry` instance in the Camel registry and, failing that, calls
`GlobalOpenTelemetry.get()`. The OpenTelemetry Spring Boot starter keeps its
SDK as a Spring bean and never registers it globally, so Camel falls back to
the no-op instance and silently drops every route span — while HTTP spans from
the starter's own instrumentation keep arriving, which makes tracing look like
it works. Publish the bean yourself:

```java
@Configuration
public class OpenTelemetryGlobalConfig {
    public OpenTelemetryGlobalConfig(OpenTelemetry openTelemetry) {
        GlobalOpenTelemetry.set(openTelemetry);
    }
}
```

The ordering works because Spring registers user `@Configuration` before
auto-configuration, so the global is in place by the time Camel's tracer
initialises.

### What gets traced automatically

With the OpenTelemetry extension on the classpath, Camel automatically creates
spans for:

- Every route entry (`from()`)
- Every `to()` / `toD()` call
- Kafka produce and consume operations
- HTTP requests (via `platform-http` and `http` components)

Each span includes:

- Route ID, node ID, and processor name
- Exchange ID (for correlation)
- Message headers (configurable — default excludes sensitive headers)
- Duration and status (OK / ERROR)

#### What changed in Camel 4.21

If you have used Camel tracing before, the span tree is a different shape now,
and the chapter you remember was written against the old one:

- Processors that send to an endpoint — `to`, `toD`, `wireTap`, `enrich` — no
  longer emit a redundant *processor* span wrapping the endpoint span. They are
  identified by the new `org.apache.camel.EndpointSending` marker interface.
  Trees are shallower and there are fewer spans per exchange.
- `camel-telemetry` gained `disableCoreProcessors`, which separates core DSL
  processors from your own. `traceProcessors` now accounts only for custom
  processors.
- `camel-opentelemetry2` no longer wraps context in a `ThreadLocal`/`Scope`,
  using Camel's exchange-passing instead. This fixes async components that
  opened a scope on one thread and closed it on another.
- `traceCustomIdOnly` now filters at *route* level: routes without an explicit
  `.routeId()` are excluded from tracing entirely. Every route in this example
  sets one, so all of them are traced.

Two knobs are worth knowing, because trace cardinality is a real cost once you
are paying to store spans:

```properties
# Trace only the processors you name, rather than all of them.
camel.opentelemetry2.include-patterns=direct:otel-*
# Leave core DSL processors out of the span tree.
camel.opentelemetry2.disable-core-processors=true
```

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

Automatic metrics per route, as they arrive in Mimir:

| Metric | Meaning |
|---|---|
| `camel_exchanges_total` | Exchanges processed, tagged with `routeId` |
| `camel_exchanges_succeeded_total` | Exchanges that completed without error |
| `camel_exchanges_failed_total` | Failed exchanges |
| `camel_exchanges_inflight` | Exchanges currently in flight |
| `camel_route_policy_milliseconds_bucket` | Route duration histogram |
| `camel_routes_running` | Routes currently running |

Two naming traps, both of which will cost you an afternoon if you hit them
cold:

**The same meter has two names depending on how it reaches you.** Scraped from
the application's own Prometheus endpoint, the route timer is
`camel_route_policy_seconds_*`. Pushed through the OTLP bridge into Mimir, it
is `camel_route_policy_milliseconds_*`. Same meter, different unit, different
name. A dashboard query written against one path silently returns nothing on
the other.

**Counters appear only once they have counted.** The Prometheus endpoint lists
every registered meter immediately, including zero-valued ones. The OTLP bridge
exports only what has recorded a value, so `camel_exchanges_failed_total` will
not exist in Mimir until something actually fails. Write alerting rules that
tolerate the series being absent.

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

## Logs in Loki

Logs reach Loki over OTLP, on the same exporter as traces and metrics — there
is no log shipper and no file to tail. Turning on the log signal is the whole
configuration:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
quarkus.otel.logs.enabled=true
```

```properties
otel.logs.exporter=otlp
```

Formatting the console as JSON is a separate concern and does *not* put logs in
Loki. It is worth doing if something else consumes your stdout, but on its own
it ships nothing.

Because the log records go through the OpenTelemetry SDK, they arrive carrying
resource and scope attributes as Loki labels, and — for anything logged inside
a route — the trace and span IDs of the exchange that produced them. That last
part is what lets you pivot from a slow trace in Tempo straight to the log
lines it emitted.

The labels you get are not the ones you might guess:

| Label | Value |
|---|---|
| `service_name` | from `quarkus.application.name` / `otel.service.name` |
| `bridge_name` | the Camel route ID that logged the line |
| `deployment_environment` | whatever you set it to; `local` here |
| `detected_level` | `info`, `warn`, … |
| `host_name` | the emitting host |

So in Grafana:

```logql
{service_name="eip-observability-stack"} |= "ORD-1001"
```

and, to narrow to one route:

```logql
{service_name="eip-observability-stack", bridge_name="otel-enrich-order"}
```

## Grafana dashboard essentials

Build dashboards around these queries:

These are the metric names as they arrive in Mimir through the OTLP bridge —
see the two naming traps above before adapting them.

**Order throughput**:
```promql
rate(camel_exchanges_total{routeId="traced-order-pipeline"}[5m])
```

**Error rate** — wrapped in `or vector(0)` because the failure counter does not
exist until the first failure:
```promql
(
  rate(camel_exchanges_failed_total{routeId="traced-order-pipeline"}[5m])
    or vector(0)
)
/ rate(camel_exchanges_total{routeId="traced-order-pipeline"}[5m])
```

**P99 route latency** — note the bucket is in milliseconds on this path:
```promql
histogram_quantile(
  0.99,
  sum by (le, routeId) (
    rate(camel_route_policy_milliseconds_bucket[5m])
  )
)
```

**Request rate by service, from Tempo's span metrics** — Tempo's
`metrics_generator` writes these into Mimir itself, so they are available
without instrumenting anything further:
```promql
sum by (service) (rate(traces_spanmetrics_calls_total[5m]))
```

### Seeing it work

Start the stack and the example, then push a few orders through it:

```bash
./scripts/setup-stack.sh --lgtm
cd examples/27-observability-stack/quarkus && mvn package -DskipTests
java -jar target/quarkus-app/quarkus-run.jar &

for i in 1 2 3 4 5; do
  echo "{\"order_id\":\"ORD-100$i\",\"customer\":\"acme\",\"amount\":$((i*250)).50}"
done | docker exec -i eip-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 --topic eip.orders.placed
```

Give it half a minute — Tempo does not make a trace searchable the instant it
arrives, and the metric export interval is ten seconds — then check all three
signals without opening Grafana:

```bash
# Traces
curl -sG localhost:3200/api/search \
  --data-urlencode 'q={resource.service.name="eip-observability-stack"}'

# Metrics
curl -sG localhost:9009/prometheus/api/v1/query \
  --data-urlencode 'query=camel_exchanges_total'

# Logs
curl -sG localhost:3100/loki/api/v1/query_range \
  --data-urlencode '{service_name="eip-observability-stack"}'
```

If traces are there but metrics and logs are not, you have the single-signal
problem described in [getting all three signals](#getting-all-three-signals).

---

*Verification status: <span class="status status--verified">verified</span> — both runtime variants build against Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1) and their 6 Citrus integration tests pass on Docker Engine; run against `setup-stack.sh --lgtm` with orders sent to `eip.orders.placed`, Tempo returns the routes' traces (10 from the Spring Boot run) and Mimir has `camel_exchanges_total` series (2026-10-09).*
