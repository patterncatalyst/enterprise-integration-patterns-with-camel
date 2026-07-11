# Chapter 13: Structural Transformation

Demonstrates aggregation with both in-memory and persistent backing stores, plus the normalizer pattern for unifying disparate partner formats into a single canonical model.

- **Aggregator (in-memory)** — correlates order line items by `order_id` using jsonpath, accumulates into a single order with a `line_items` list and running `total_amount`; completes after 3 items or 10s timeout
- **Aggregator (PostgreSQL JDBC)** — same aggregation logic backed by `PostgresAggregationRepository` on PostgreSQL so in-flight aggregations survive restarts; completes after 3 items or 15s timeout
- **Normalizer** — three parallel routes consume from partner-specific topics with different field naming and translate each to a single canonical format

## Running

```bash
# From repo root — start the infrastructure stack
./scripts/setup-stack.sh

# Run the example
cd examples/13-aggregator && mvn quarkus:dev
```

## Infrastructure

Requires Kafka and PostgreSQL from the Podman stack.

## Data flow

```
eip.orders.line-items → [Aggregator (memory)]     → eip.orders.complete
                      → [Aggregator (PostgreSQL)] → eip.orders.complete-persistent

eip.orders.partner-a ─┐
eip.orders.partner-b ─┤→ [Normalizer] → eip.orders.normalized
eip.orders.partner-c ─┘
```

## What to observe

1. Individual line items arriving on `eip.orders.line-items` correlated by `order_id`
2. In-memory aggregator assembling line items into a complete order with a `line_items` list and running `total_amount`, completing after 3 items or 10s timeout
3. PostgreSQL-backed aggregator performing the same assembly with persistent state, completing after 3 items or 15s timeout
4. Aggregated orders appearing on `eip.orders.complete` (in-memory) and `eip.orders.complete-persistent` (PostgreSQL)
5. Three normalizer routes consuming partner-specific formats from `eip.orders.partner-a`, `eip.orders.partner-b`, and `eip.orders.partner-c`
6. Each partner format translated to canonical format and published to `eip.orders.normalized`

## How to test

**Aggregator** -- produce three line items with the same `order_id` to `eip.orders.line-items` via Kafka UI at [localhost:8090](http://localhost:8090):

```json
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-A", "quantity": 1, "price": 29.99}
```

```json
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-B", "quantity": 2, "price": 49.99}
```

```json
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-C", "quantity": 1, "price": 19.99}
```

Watch the aggregated order appear on `eip.orders.complete` (completionSize=3 or 10s timeout).

**Normalizer** -- produce orders in partner-specific formats:

Partner A (`eip.orders.partner-a`):

```json
{"orderId": 42, "client": "C-200", "product": "SKU-X", "count": 3, "total": 89.99}
```

Partner B (`eip.orders.partner-b`):

```json
{"order_number": 43, "buyer_ref": "C-201", "sku": "SKU-Y", "qty": 1, "price": 14.99}
```

Partner C (`eip.orders.partner-c`):

```json
{"po_id": 44, "account": "C-202", "item_code": "SKU-Z", "units": 5, "value": 199.99}
```

All arrive in canonical format on `eip.orders.normalized`.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.line-items` | Individual order line items (input to both aggregators) |
| `eip.orders.complete` | Assembled orders from in-memory aggregator |
| `eip.orders.complete-persistent` | Assembled orders from PostgreSQL-backed aggregator |
| `eip.orders.partner-a` | Orders from Partner A format |
| `eip.orders.partner-b` | Orders from Partner B format |
| `eip.orders.partner-c` | Orders from Partner C format |
| `eip.orders.normalized` | Canonical-format orders (normalizer output) |

## PostgreSQL tables

| Table | Description |
|-------|-------------|
| `camel_aggregation` | Managed by `PostgresAggregationRepository` for persistent in-flight aggregation state |

---
*Verification status: unverified.*
