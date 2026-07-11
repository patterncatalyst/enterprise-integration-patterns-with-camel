# Kafka Producer Tuning — Appendix O Example

Demonstrates four Kafka producer tuning profiles from Chapter 33 (Appendix O):

1. **Batched producer** — maximizes throughput with `lingerMs=100` and `batchSize=65536` to accumulate records before sending
2. **Compressed producer** — uses LZ4 compression for large messages, reducing network bandwidth
3. **Idempotent producer** — enables `enable.idempotence=true` for exactly-once producer semantics with automatic deduplication
4. **Synchronous producer** — blocks until broker acknowledgment with `synchronous=true` and `acks=all`, includes error handling

## Running

```bash
# Start the infrastructure stack
cd ../../
./scripts/setup-stack.sh

# Run the example
cd examples/33-kafka-producer-tuning
mvn quarkus:dev
```

Each producer profile includes a verifier consumer that confirms messages were received correctly.

## What to observe

- **Batched producer**: sends at 1s intervals; Kafka batches records into fewer network requests
- **Compressed producer**: sends large orders with multiple items; LZ4 reduces payload size
- **Idempotent producer**: safe to retry without duplicates — broker deduplicates using sequence numbers
- **Synchronous producer**: blocks until all ISR replicas acknowledge; error handler catches failures
