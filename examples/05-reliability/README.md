# Chapter 5: Channel Reliability

Demonstrates error handling and guaranteed delivery with Apache Camel on Quarkus:

- **Dead Letter Channel** — failed orders retry 3 times then route to `eip.orders.dlq`
- **Guaranteed Delivery** — Kafka `acks=all` ensures messages survive broker failures
- **DLQ Monitor** — a consumer that watches the dead letter queue and logs failures

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../05-reliability
mvn quarkus:dev
```

Every 5th order simulates a processing failure. Watch the logs to see retry attempts and eventual DLQ routing.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders |
| `eip.orders.processed` | Successfully processed orders |
| `eip.orders.dlq` | Dead letter queue for failed orders |

---

*Verification status: unverified.*
