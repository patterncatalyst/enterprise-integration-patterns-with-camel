# EIP Local Infrastructure Stack

Podman compose files for the Enterprise Integration Patterns tutorial.
Two composable layers: the **base stack** (messaging + data) and an optional
**LGTM overlay** (observability).

## Quick start

```bash
# Base stack only (Kafka, Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI)
podman-compose -f compose.yaml up -d

# Base + LGTM observability (adds Grafana, Loki, Tempo, Mimir, OTel Collector)
podman-compose -f compose.yaml -f compose.lgtm.yaml up -d
```

Or use the one-command bootstrap from the project root:

```bash
scripts/setup-stack.sh          # base only
scripts/setup-stack.sh --lgtm   # base + observability
```

## Services

### Base stack (`compose.yaml`)

| Service | Port(s) | URL |
|---------|---------|-----|
| Kafka (KRaft) | 9092 (host), 9094 (inter-container) | — |
| Kafka UI | 8090 | http://localhost:8090 |
| Pulsar | 6650 (binary), 8080 (admin) | http://localhost:8080 |
| Redis | 6379 | — |
| PostgreSQL | 5432 | `psql -h localhost -U eipuser -d eipdb` |
| Apicurio Registry | 8081 | http://localhost:8081 |

### LGTM overlay (`compose.lgtm.yaml`)

| Service | Port(s) | URL |
|---------|---------|-----|
| Grafana | 3000 | http://localhost:3000 |
| Loki | 3100 | — |
| Tempo | 3200 | — |
| Mimir | 9009 | — |
| OTel Collector | 4317 (gRPC), 4318 (HTTP) | — |

## Application telemetry endpoint

Point your Quarkus Camel services at the OTel Collector:

```properties
# application.properties
quarkus.otel.exporter.otlp.endpoint=http://otel-collector:4317
quarkus.otel.exporter.otlp.protocol=grpc
```

Or from the host (outside the compose network):

```properties
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
```

## PostgreSQL schemas

The init script creates five domain schemas with seed data:

| Schema | Table | Domain |
|--------|-------|--------|
| `orders` | `orders` | Order lifecycle |
| `inventory` | `stock` | SKU availability (seeded with 3 SKUs) |
| `payments` | `payments` | Payment processing |
| `shipping` | `shipments` | Carrier tracking |
| `notifications` | `notifications` | Event-driven alerts |

## Tear down

```bash
# Stop and remove containers (keep volumes)
podman-compose -f compose.yaml -f compose.lgtm.yaml down

# Stop, remove containers AND volumes (full reset)
podman-compose -f compose.yaml -f compose.lgtm.yaml down -v
```

## Network

All services share the `eip-net` network. Inside the network, services
reach each other by service name (e.g., `kafka:9094`, `redis:6379`,
`otel-collector:4317`).
