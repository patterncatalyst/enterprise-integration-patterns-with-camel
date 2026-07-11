# Appendix F: Drools and Business Rules

Demonstrates rule-based content routing using Drools 10 Rule Units with Camel Quarkus. Incoming orders are evaluated against a set of DRL rules that assign a routing decision, and Camel routes each order to the appropriate destination topic based on that decision.

- **Rule Unit with DRL** -- order routing logic is expressed as declarative Drools rules in a `.drl` file, evaluated via a Drools Rule Unit
- **Rule-based content routing via Camel bean** -- a CDI bean wraps the Drools rule unit and integrates with Camel as a bean processor, setting routing headers based on rule outcomes
- **Multiple routing destinations** -- orders are routed to `standard`, `express`, `hazmat`, or `fraud-review` topics depending on order attributes (amount, destination country, hazmat flag)

## Running

```bash
# Start the infrastructure stack (Kafka required)
./scripts/setup-stack.sh

cd examples/24-drools-rules
mvn quarkus:dev
```

## Infrastructure

Requires **Kafka** from the Podman stack.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders consumed by the rule-based router |
| `eip.orders.standard` | Orders routed via the default standard path |
| `eip.orders.express` | Orders with amount >= $500 routed to priority handling |
| `eip.orders.hazmat` | Orders containing hazardous materials |
| `eip.orders.fraud-review` | High-value international orders flagged for fraud review |

## How to test

Produce sample JSON messages to the `eip.orders.placed` topic and observe the routing decisions in the application logs.

**Standard order** (amount < $500, domestic, no hazmat):

```bash
echo '{"order_id": 1001, "customer_id": "C-100", "amount": 49.99}' | \
  kcat -b localhost:9092 -t eip.orders.placed -P
```

**Express order** (amount >= $500):

```bash
echo '{"order_id": 1002, "customer_id": "C-200", "amount": 750.00, "destination_country": "US"}' | \
  kcat -b localhost:9092 -t eip.orders.placed -P
```

**Hazmat order** (contains hazardous materials):

```bash
echo '{"order_id": 1003, "customer_id": "C-300", "amount": 120.00, "contains_hazmat": true}' | \
  kcat -b localhost:9092 -t eip.orders.placed -P
```

**High-value international order** (amount >= $10,000, non-US destination):

```bash
echo '{"order_id": 1004, "customer_id": "C-400", "amount": 15000.00, "destination_country": "DE"}' | \
  kcat -b localhost:9092 -t eip.orders.placed -P
```

---

*Verification status: unverified.*
