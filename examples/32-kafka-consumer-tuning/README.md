# Kafka Consumer Tuning — Appendix N Example

Demonstrates three Kafka consumer tuning profiles from Chapter 32 (Appendix N). Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

1. **Throughput-tuned consumer** — maximizes throughput with large `fetchMinBytes`, long `fetchWaitMaxMs`, high `maxPollRecords`, and auto-commit
2. **Safety-first consumer** — prioritizes correctness with manual commit, `read_committed` isolation, `breakOnFirstError`, and `maxPollRecords=1`
3. **Static group membership** — uses `groupInstanceId` for stable partition assignment across restarts (no rebalance storms)

## Running

```bash
# Start the infrastructure stack
./scripts/setup-stack.sh

# Quarkus
cd examples/32-kafka-consumer-tuning/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/32-kafka-consumer-tuning/spring-boot
mvn spring-boot:run
```

Each consumer profile includes a timer-driven producer that generates test orders on its own topic.

## What to observe

- **Throughput consumer**: processes messages in large batches with auto-commit — high throughput, at-least-once semantics
- **Safety consumer**: processes one message at a time, commits manually after processing — exactly-once semantics with `read_committed`
- **Static member**: uses a PID-based `groupInstanceId` so restarting the consumer doesn't trigger a rebalance across the group

---

*Verification status: unverified. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
