# Chapter 14: Consumer Patterns

Demonstrates four consumer patterns with Apache Camel on Quarkus:

- **Polling Consumer** — timer-triggered `pollEnrich` pulls messages from Kafka on demand
- **SQL Polling Consumer** — polls `orders.orders` in PostgreSQL for unprocessed rows, marks them as processing, and publishes to Kafka
- **Event-Driven Consumer** — standard `from("kafka:…")` pushes messages as they arrive
- **Pulsar Event-Driven Consumer** — push-based consumption from Pulsar with a `Shared` subscription and 3 consumers
- **Competing Consumers** — `consumersCount=3` runs parallel consumers within one instance
- **Message Dispatcher** — single consumer dispatches to handler routes based on `event_type`

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../14-consumer-patterns
mvn quarkus:dev
```

The demo data generator produces order events every 3 seconds to Kafka and inserts demo orders into PostgreSQL every 30 seconds for the SQL polling consumer.

## Infrastructure

Requires the full Podman stack (Kafka + Pulsar + PostgreSQL).

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.consumer.orders` | Demo data generator output |
| `eip.consumer.poll` | Polling consumer source |
| `eip.consumer.events` | Event-driven consumer source |
| `eip.consumer.compete` | Competing consumers source |
| `eip.consumer.dispatch` | Message dispatcher source |

---

*Verification status: unverified.*
