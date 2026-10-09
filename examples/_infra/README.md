# EIP Local Infrastructure Stack

Docker Compose files (Docker Engine, `docker compose` v2 plugin) for the Enterprise Integration Patterns tutorial.
Two composable layers: the **base stack** (messaging + data) and an optional
**LGTM overlay** (observability).

> **This stack and the integration tests cannot run at the same time.** The
> Citrus tests start their own Kafka, Redis, PostgreSQL and Pulsar through
> Testcontainers, on the same host ports (9092, 6379, 5432, 6650). Bring this
> stack down before running them, and note that Testcontainers needs
> the Docker daemon reachable on the default context — see
> [CONTRIBUTING.md](../../CONTRIBUTING.md#running-the-tests).

## Quick start

```bash
# Base stack only (Kafka, Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI)
docker compose -p eip -f compose.yaml up -d

# Base + LGTM observability (adds Grafana, Loki, Tempo, Mimir, OTel Collector)
docker compose -p eip -f compose.yaml -f compose.lgtm.yaml up -d
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

| Service | Port(s) | Readiness check |
|---------|---------|-----|
| Grafana | 3000 | `curl -s localhost:3000/api/health` |
| Loki | 3100 | `curl -s localhost:3100/ready` |
| Tempo | 3200 (query API) | `curl -s localhost:3200/ready` |
| Mimir | 9009 | `curl -s localhost:9009/ready` |
| OTel Collector | 4317 (gRPC), 4318 (HTTP), 13133 (health) | `curl -s localhost:13133/` |

Only Grafana defines a container healthcheck. Loki, Mimir and the collector
ship **distroless** images — no shell, no `wget`, no `curl` — so an
in-container probe cannot run in them at all, and `depends_on` with
`condition: service_healthy` against those services would block forever.
`setup-stack.sh` polls the HTTP endpoints above from the host instead.

Applications send everything to the collector, which fans out to the other
three. Tempo runs its own OTLP receiver, but only on the container network,
where the collector reaches it at `tempo:4318`. Exporting to Tempo's 3200 from
a host application looks plausible, returns no error, and discards the data.

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
docker compose -p eip -f compose.yaml -f compose.lgtm.yaml down

# Stop, remove containers AND volumes (full reset)
docker compose -p eip -f compose.yaml -f compose.lgtm.yaml down -v
```

## Network

All services share the `eip-net` network. Inside the network, services
reach each other by service name (e.g., `kafka:9094`, `redis:6379`,
`otel-collector:4317`).
