# Kafka Producer Tuning — Appendix O Example

Demonstrates four Kafka producer tuning profiles from Chapter 33 (Appendix O). Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

1. **Batched producer** — maximizes throughput with `lingerMs=100` and `batchSize=65536` to accumulate records before sending
2. **Compressed producer** — uses LZ4 compression for large messages, reducing network bandwidth
3. **Idempotent producer** — enables `enable.idempotence=true` for exactly-once producer semantics with automatic deduplication
4. **Synchronous producer** — blocks until broker acknowledgment with `synchronous=true` and `acks=all`, includes error handling

## Running

```bash
# Start the infrastructure stack
./scripts/setup-stack.sh

# Quarkus
cd examples/33-kafka-producer-tuning/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/33-kafka-producer-tuning/spring-boot
mvn spring-boot:run
```

Each producer profile includes a verifier consumer that confirms messages were received correctly.

## What to observe

- **Batched producer**: sends at 1s intervals; Kafka batches records into fewer network requests
- **Compressed producer**: sends large orders with multiple items; LZ4 reduces payload size
- **Idempotent producer**: safe to retry without duplicates — broker deduplicates using sequence numbers
- **Synchronous producer**: blocks until all ISR replicas acknowledge; error handler catches failures

---

*Verification status: unverified. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
