# Appendix I: Observability Stack

Demonstrates end-to-end observability for Camel routes using OpenTelemetry distributed tracing, Micrometer metrics with Prometheus, and custom health probe endpoints. Traces propagate automatically across Kafka-backed and direct Camel routes, giving full visibility into the order processing pipeline through the LGTM stack (Grafana, Loki, Tempo, Mimir).

- **Auto-instrumented distributed tracing** -- OpenTelemetry traces span the full order pipeline (validate, enrich, complete) with each direct route appearing as a child span in Tempo
- **Custom Micrometer metrics (counters, timers)** -- orders counted by destination country and processing time recorded as a Micrometer timer, exposed via the Prometheus endpoint
- **Route health probe REST endpoint** -- reports the status, completed exchanges, and failed exchanges for every running Camel route

## Running

```bash
# From the repository root -- start Kafka and the LGTM observability overlay
./scripts/setup-stack.sh --lgtm

cd examples/27-observability-stack && mvn quarkus:dev
```

## Infrastructure

Requires **Kafka** and the **LGTM stack** (Grafana, Loki, Tempo, Mimir, OTel Collector) from the Podman compose stack.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders consumed by the traced pipeline and the metrics counter |
| `eip.orders.processed` | Completed orders published by the traced pipeline |

## How to test

**Produce an order** via Kafka UI at [http://localhost:8090](http://localhost:8090) on topic `eip.orders.placed`:

```json
{"order_id": 9001, "customer_id": "C-700", "item_sku": "SKU-OT", "quantity": 2, "amount": 149.99, "country": "US"}
```

**View traces in Grafana Tempo** -- open [http://localhost:3000](http://localhost:3000), navigate to Explore, select the Tempo data source, and search for traces from `eip-observability-stack`. The trace shows the full span tree: `traced-order-pipeline` -> `otel-validate-order` -> `otel-enrich-order` -> `otel-complete-order`.

**View metrics** -- query the Prometheus endpoint for Camel and custom metrics:

```bash
curl http://localhost:8087/q/metrics | grep -E "camel_|eip_orders"
```

**Check order metrics summary**:

```bash
curl http://localhost:8087/metrics/orders
```

**Check route health**:

```bash
curl http://localhost:8087/health/routes
```

---

*Verification status: unverified.*
