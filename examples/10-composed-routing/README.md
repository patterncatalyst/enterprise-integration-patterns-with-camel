# Chapter 10: Composed Routing

Demonstrates composed routing patterns with Apache Camel on Quarkus:

- **Scatter-Gather** — fan out shipping rate requests to FedEx, UPS, USPS in parallel; aggregate the best rate
- **Routing Slip** — dynamically build a processing pipeline (validate → hazmat check → customs → carrier assignment) based on order content

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../10-composed-routing
mvn quarkus:dev
```

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.shipping.rate-requests` | Incoming rate requests (for Scatter-Gather) |
| `eip.shipping.best-rate` | Best carrier rate result |
| `eip.orders.placed` | Incoming orders (for Routing Slip) |

## How to test

Produce a rate request message to `eip.shipping.rate-requests`:

```json
{"order_id": 1, "weight_kg": 5.0, "destination_country": "US"}
```

Watch the logs to see all three carriers quoted and the best rate selected.

---

*Verification status: unverified.*
