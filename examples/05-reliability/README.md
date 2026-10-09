# Chapter 5: Channel Reliability

Demonstrates error handling and guaranteed delivery with Apache Camel. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

- **Dead Letter Channel** — failed orders retry 3 times at 1-second intervals then route to `eip.orders.dlq`; a DLQ monitor route logs each failure with the exception reason
- **Guaranteed Delivery** — Kafka producer `acks=all` ensures messages survive broker failures

## Running

```bash
# Start the full infrastructure stack
./scripts/setup-stack.sh

# Quarkus
cd examples/05-reliability/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/05-reliability/spring-boot
mvn spring-boot:run
```

This example has no demo data generator — it relies on messages on `eip.orders.placed` from other examples (e.g., Chapter 4) or external producers.

## Infrastructure

Requires Kafka from the compose stack.

## Data flow

![Data flow for Chapter 5: Channel Reliability](../../assets/diagrams/ex-05-reliability.svg)

## What to observe

1. Orders consumed from `eip.orders.placed`
2. Most orders processed successfully and forwarded to `eip.orders.processed`
3. Every 5th order (`orderId % 5 == 0`) fails, retries 3 times, then lands in `eip.orders.dlq`
4. The DLQ monitor logs each failed message with the exception reason

Open Kafka UI at [http://localhost:8090](http://localhost:8090) to inspect the `eip.orders.dlq` topic.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders (input) |
| `eip.orders.processed` | Successfully processed orders |
| `eip.orders.dlq` | Dead letter queue for failed orders |

---

*Verification status: both variants build against Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1); the chapter footer records the integration-test result on Docker Engine (2026-10-09).*
