# Chapter 15: Producer Patterns

Demonstrates messaging endpoint patterns with Apache Camel on Quarkus:

- **Idempotent Receiver** — deduplicates orders by `order_id` using a JDBC-backed `JdbcMessageIdRepository` in PostgreSQL
- **Service Activator** — receives a Kafka message and invokes a CDI bean (`InventoryService`) via `.bean()` to check stock levels
- **Durable Subscriber** — Pulsar subscription that maintains cursor state across restarts, resuming from the last acknowledged message
- **Transactional Client / Outbox Pattern** — writes payment record and outbox event in a single PostgreSQL transaction, then a separate route polls and publishes to Kafka

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../15-endpoints
mvn quarkus:dev
```

## Infrastructure

Requires the full Podman stack (Kafka + Pulsar + PostgreSQL).

## Data flow

```
eip.orders.placed → [Idempotent Receiver (JDBC)] → eip.orders.deduplicated
                                                          ↓
                                                 [Service Activator]
                                                          ↓
                                                 eip.orders.inventory-checked

eip.payments.required → [Transactional Client] → PostgreSQL (payments + outbox)
                                                          ↓
                                                 [Outbox Publisher]
                                                          ↓
                                                 eip.payments.processed

Pulsar eip.orders.placed → [Durable Subscriber]
```

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders (may contain duplicates) |
| `eip.orders.deduplicated` | Deduplicated orders |
| `eip.orders.inventory-checked` | Orders enriched with stock info |
| `eip.payments.required` | Payment requests |
| `eip.payments.processed` | Processed payments (published from outbox) |

## PostgreSQL tables

| Table | Description |
|-------|-------------|
| `payments.payments` | Payment records |
| `payments.outbox` | Transactional outbox events |
| `camel_messageprocessed` | Idempotent receiver dedup tracking |

---

*Verification status: unverified.*
