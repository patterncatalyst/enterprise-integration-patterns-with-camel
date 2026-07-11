# Chapter 13: Structural Transformation

Demonstrates structural transformation patterns with Apache Camel on Quarkus:

- **Aggregator** — collects individual order line items and assembles them into a complete order by `order_id`, using `completionSize(3)` and `completionTimeout(10000)`
- **Persistent Aggregator** — same aggregation logic backed by a PostgreSQL `JdbcAggregationRepository` so in-flight aggregations survive restarts
- **Normalizer** — receives orders from three partner sources in different formats and translates each to a canonical data model

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../13-aggregator
mvn quarkus:dev
```

## Data flow

```
eip.orders.line-items → [Aggregator (memory)]     → eip.orders.complete
eip.orders.line-items → [Aggregator (PostgreSQL)] → eip.orders.complete-persistent

eip.orders.partner-a ─┐
eip.orders.partner-b ─┤→ [Normalizer] → eip.orders.normalized
eip.orders.partner-c ─┘
```

## How to test

**Aggregator** — produce three line items with the same `order_id` to `eip.orders.line-items`:

```json
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-A", "quantity": 1, "price": 29.99}
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-B", "quantity": 2, "price": 49.99}
{"order_id": 1001, "customer_id": "C-100", "item_sku": "SKU-C", "quantity": 1, "price": 19.99}
```

Watch the aggregated order appear on `eip.orders.complete`.

**Normalizer** — produce orders in partner-specific formats:

```json
// Partner A
{"orderId": 42, "client": "C-200", "product": "SKU-X", "count": 3, "total": 89.99}

// Partner B
{"order_number": 43, "buyer_ref": "C-201", "sku": "SKU-Y", "qty": 1, "price": 14.99}

// Partner C
{"po_id": 44, "account": "C-202", "item_code": "SKU-Z", "units": 5, "value": 199.99}
```

All three arrive in canonical format on `eip.orders.normalized`.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.line-items` | Individual order line items |
| `eip.orders.complete` | Assembled complete orders (in-memory) |
| `eip.orders.complete-persistent` | Assembled complete orders (PostgreSQL-backed) |
| `eip.orders.partner-a` | Orders from Partner A format |
| `eip.orders.partner-b` | Orders from Partner B format |
| `eip.orders.partner-c` | Orders from Partner C format |
| `eip.orders.normalized` | Canonical-format orders |

---

*Verification status: unverified.*
