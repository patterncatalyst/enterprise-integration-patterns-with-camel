# Appendix D: Redis for Integration

Demonstrates three integration patterns that use Redis alongside Apache Camel on Quarkus: cache-aside enrichment to accelerate message processing, Redis-backed idempotent consumption for exactly-once semantics, and distributed locking to coordinate scheduled tasks across instances.

- **Caching enrichment** -- consumes orders from Kafka, checks Redis for cached customer data, falls back to a simulated DB lookup on cache miss, and caches the result with a TTL
- **Idempotent receiver with Redis** -- uses Redis SET NX to deduplicate payment events so that redelivered messages are safely skipped
- **Distributed locking** -- acquires a Redis lock (SET NX EX) before running a nightly order export, ensuring only one instance executes the task

## Running

```bash
# Start the infrastructure stack (Kafka and Redis required)
./scripts/setup-stack.sh

cd examples/22-redis-integration
mvn quarkus:dev
```

## Infrastructure

Requires **Kafka** and **Redis** from the Podman stack.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders consumed by the caching enricher |
| `eip.orders.enriched` | Enriched orders produced after cache-aside lookup |
| `eip.orders.payments` | Payment events consumed by the idempotent receiver |
| `eip.orders.payment-confirmed` | Deduplicated payment confirmations |

## Redis keys

| Key pattern | Description |
|-------------|-------------|
| `customer:<id>` | Cached customer name (TTL 10 minutes) |
| `idempotent:<event_id>` | Deduplication marker (TTL 24 hours) |
| `lock:nightly-order-export` | Distributed lock for scheduled export (TTL 30 seconds) |

## How to test

1. Start the application with `mvn quarkus:dev`
2. Produce an order to `eip.orders.placed` via Kafka UI at [http://localhost:8090](http://localhost:8090):
   ```json
   {"order_id": 1001, "customer_id": "C-042", "item_sku": "SKU-A1", "quantity": 3, "amount": 89.97}
   ```
3. Watch the logs for cache miss on first run and cache hit on subsequent orders for the same customer
4. Produce a payment event to `eip.orders.payments`:
   ```json
   {"event_id": "evt-5001", "order_id": 1001, "amount": 89.97}
   ```
5. Produce the same event again and confirm the duplicate is skipped
6. Observe the distributed lock route firing every 60 seconds in the logs
7. Inspect Redis keys:
   ```bash
   podman exec eip-redis redis-cli keys '*'
   ```

---

*Verification status: unverified.*
