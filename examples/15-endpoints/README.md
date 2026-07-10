# Chapter 15: Producer Patterns

Demonstrates messaging endpoint patterns with Apache Camel on Quarkus:

- **Idempotent Receiver** — deduplicates orders by `order_id` using `MemoryIdempotentRepository`
- **Service Activator** — receives a Kafka message and invokes a CDI bean (`InventoryService`) via `.bean()` to check stock levels

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../15-endpoints
mvn quarkus:dev
```

## Data flow

```
eip.orders.placed → [Idempotent Receiver] → eip.orders.deduplicated
                                                    ↓
                                           [Service Activator]
                                                    ↓
                                           eip.orders.inventory-checked
```

## How to test

Produce an order to `eip.orders.placed`:

```json
{"order_id": 5001, "customer_id": "C-300", "item_sku": "SKU-ABC", "quantity": 2, "amount": 149.99}
```

Produce the same message again — the duplicate is silently dropped. The first message flows through the `InventoryService` bean, which checks stock and adds `in_stock`, `available_quantity`, and `inventory_checked_at` fields.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders (may contain duplicates) |
| `eip.orders.deduplicated` | Deduplicated orders |
| `eip.orders.inventory-checked` | Orders enriched with stock info |

---

*Verification status: unverified.*
