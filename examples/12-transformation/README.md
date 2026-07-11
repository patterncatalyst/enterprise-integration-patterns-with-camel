# Chapter 12: Transformation Fundamentals

Demonstrates message transformation patterns with Apache Camel on Quarkus:

- **Message Translator** — converts external order format (orderNumber, clientRef, productCode) to canonical format (order_id, customer_id, item_sku)
- **Content Enricher** — augments orders with product data from a Redis-backed catalog (SKU → product name, category, weight, shipping zone)
- **Content Filter** — strips PII fields, keeping only analytics-safe data

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../12-transformation
mvn quarkus:dev
```

## Infrastructure

Requires Kafka and Redis from the Podman stack. On startup, the `RedisProductCatalog` seeds product data into Redis hashes (`product:SKU-*`).

## Data flow

```
eip.orders.external → [Translator] → eip.orders.placed
                                          ↓
                                     [Enricher (Redis)] → eip.orders.enriched
                                                               ↓
                                                          [Filter] → eip.orders.analytics
```

## How to test

Produce an external-format order to `eip.orders.external`:

```json
{"orderNumber": 42, "clientRef": "C-100", "productCode": "SKU-ABC", "qty": 2, "totalValue": 149.99}
```

Watch it transform through all three stages.

---

*Verification status: unverified.*
