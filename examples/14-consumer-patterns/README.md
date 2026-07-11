# Chapter 14: Consumer Patterns

Demonstrates four consumer patterns with Apache Camel on Quarkus:

- **Polling Consumer** — timer-triggered `pollEnrich` pulls messages from Kafka on demand
- **Event-Driven Consumer** — standard `from("kafka:…")` pushes messages as they arrive
- **Competing Consumers** — `consumersCount=3` runs parallel consumers within one instance
- **Message Dispatcher** — single consumer dispatches to handler routes based on `event_type`

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../14-consumer-patterns
mvn quarkus:dev
```

The demo data generator produces order events every 3 seconds with rotating event types (`order_placed`, `order_cancelled`, `order_refunded`).

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
