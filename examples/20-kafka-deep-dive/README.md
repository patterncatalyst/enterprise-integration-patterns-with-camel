# Appendix B: Kafka Deep Dive

Explores advanced Apache Kafka patterns with Camel Quarkus: key-based partitioning for ordered processing, transactional consume-transform-produce pipelines with manual offset control, and consumer group lag monitoring via the Kafka AdminClient.

- **Key-based partitioning** -- produces orders with the order ID as the Kafka key so that all events for a given order land on the same partition, preserving per-key ordering
- **Transactional pipeline** -- consumes from `eip.orders.placed`, enriches each order with warehouse assignment and priority, then produces to `eip.orders.enriched` with idempotent writes and manual offset commits
- **Consumer lag monitoring** -- periodically queries the Kafka AdminClient for committed offsets of the transactional pipeline consumer group

## Running

```bash
# Start the infrastructure stack (Kafka required)
./scripts/setup-stack.sh

cd examples/20-kafka-deep-dive
mvn quarkus:dev
```

## Infrastructure

Requires Kafka from the Podman stack.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders produced by the partitioned producer |
| `eip.orders.enriched` | Enriched orders output by the transactional pipeline |

## How to test

1. Start the application and watch the logs for partitioned producer output every 5 seconds
2. Observe that orders with the same key consistently land on the same partition
3. Check that the transactional pipeline enriches each order and commits offsets only after a successful produce to `eip.orders.enriched`
4. Every 30 seconds the lag monitor logs committed offsets for the `transactional-pipeline` consumer group
5. Open Kafka UI at [http://localhost:8090](http://localhost:8090) to inspect topics and consumer group state

---

*Verification status: unverified.*
