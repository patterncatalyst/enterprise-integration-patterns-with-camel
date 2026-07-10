# Chapter 12: Transformation Fundamentals

Demonstrates message transformation patterns with Apache Camel on Quarkus:

- **Message Translator** — converts external order format (orderNumber, clientRef, productCode) to canonical format (order_id, customer_id, item_sku)
- **Content Enricher** — augments orders with address data from a lookup service
- **Content Filter** — strips PII fields, keeping only analytics-safe data

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../12-transformation
mvn quarkus:dev
```

## Data flow

```
eip.orders.external → [Translator] → eip.orders.placed
                                          ↓
                                     [Enricher] → eip.orders.enriched
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
