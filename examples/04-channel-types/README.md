# Chapter 4: Channel Types

Demonstrates three fundamental messaging channel patterns with Apache Camel on Quarkus:

- **Point-to-Point Channel** — a single consumer group (`p2p-order-processor`) ensures each order is processed by exactly one consumer (competing consumers model)
- **Publish-Subscribe Channel** — one `eip.orders.events` topic with three independent consumer groups (`subscriber-inventory`, `subscriber-notification`, `subscriber-analytics`) so every subscriber receives every message
- **Datatype Channel** — incoming orders are routed by `status` field to dedicated topics (`eip.orders.placed.typed`, `eip.orders.cancelled`, `eip.orders.refunded`), each carrying a single event type
- **Pulsar P2P** — same Point-to-Point pattern on Apache Pulsar with a `Shared` subscription
- **Pulsar Pub/Sub** — fan-out to three independent `Exclusive` subscriptions on Pulsar

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../04-channel-types
mvn quarkus:dev
```

## Infrastructure

Requires the full Podman stack (Kafka + Pulsar):

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
```

## What to observe

In the logs you will see:

1. **Demo data generator** producing orders every 5 seconds to both Kafka and Pulsar
2. **Point-to-Point** — each order consumed once and forwarded to `eip.orders.processed` (Kafka) and logged (Pulsar)
3. **Pub/Sub fan-out** — the same order event logged by all three subscribers on both Kafka and Pulsar
4. **Datatype routing** — orders sorted into type-specific topics, with dedicated consumers confirming receipt

## Kafka topics

| Topic | Pattern | Description |
|-------|---------|-------------|
| `eip.orders.placed` | Inbound | Incoming orders from the demo generator |
| `eip.orders.processed` | P2P | Successfully processed orders |
| `eip.orders.events` | Pub/Sub | Shared event topic for fan-out |
| `eip.orders.placed.typed` | Datatype | Orders with status `placed` |
| `eip.orders.cancelled` | Datatype | Orders with status `cancelled` |
| `eip.orders.refunded` | Datatype | Orders with status `refunded` |

---

*Verification status: unverified.*
