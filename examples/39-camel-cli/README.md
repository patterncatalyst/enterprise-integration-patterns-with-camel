# Appendix U: Camel CLI Deep Dive

Two YAML DSL routes demonstrating the Camel CLI workflow from prototype to production.

## Routes

| File | Description |
|------|-------------|
| `order-router.yaml` | REST API on `/api/orders` that routes orders by `orderType` header to `eip.orders.express`, `eip.orders.standard`, or `eip.orders.bulk` Kafka topics |
| `order-enricher.yaml` | Consumes from `eip.orders.express`, enriches with customer data from Redis, publishes to `eip.orders.enriched` |

## Prerequisites

- **JBang with Camel CLI** — `jbang app install camel@apache/camel`
- **Java 25+**
- **Kafka + Redis** — start the Podman stack from the project root:
  ```bash
  ./scripts/setup-stack.sh
  ```

## Running

Start both routes with the Camel CLI:

```bash
# Run in standard mode
camel run *.yaml

# Run in dev mode (live reload on file changes)
camel run --dev *.yaml
```

## CLI workflow walkthrough

1. **Run the routes**
   ```bash
   camel run *.yaml
   ```

2. **Trace live exchanges**
   ```bash
   camel trace
   ```

3. **Inspect routes**
   ```bash
   camel get routes
   ```

4. **Export to a Quarkus project**
   ```bash
   camel export --runtime=quarkus --gav=com.eipbook:order-router:1.0
   ```

5. **Export to a Spring Boot project**
   ```bash
   camel export --runtime=spring-boot --gav=com.eipbook:order-router:1.0
   ```

## Testing

Submit an express order:

```bash
curl -X POST http://localhost:8088/api/orders \
  -H "Content-Type: application/json" \
  -H "orderType: EXPRESS" \
  -d '{"orderId":"ORD-9001","customerId":"CUST-42","item":"Wireless Headphones","quantity":2}'
```

Submit a standard order:

```bash
curl -X POST http://localhost:8088/api/orders \
  -H "Content-Type: application/json" \
  -H "orderType: STANDARD" \
  -d '{"orderId":"ORD-9002","customerId":"CUST-17","item":"USB-C Cable","quantity":5}'
```

Submit a bulk order:

```bash
curl -X POST http://localhost:8088/api/orders \
  -H "Content-Type: application/json" \
  -H "orderType: BULK" \
  -d '{"orderId":"ORD-9003","customerId":"CUST-08","item":"Packing Tape","quantity":500}'
```

---

*Verification status: unverified.*
