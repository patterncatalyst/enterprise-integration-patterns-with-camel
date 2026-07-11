# Chapter 11: Advanced Routing

Demonstrates advanced routing patterns with Apache Camel on Quarkus:

- **Dynamic Router** — route messages through a sequence of endpoints determined at runtime by a bean that returns the next destination (or null to stop)
- **Wire Tap** — send a copy of each order to an audit channel without blocking the main processing flow
- **Resequencer** — reorder out-of-sequence messages by a sequence number header using batch mode
- **Composed Message Processor** — split an order into line items, process each in parallel (validate, price lookup), then aggregate the results back
- **Load Balancer** — distribute order processing across multiple endpoints using round-robin balancing

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../11-advanced-routing
mvn quarkus:dev
```

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders (demo data generator) |
| `eip.orders.dynamic-routed` | Orders processed through dynamic router |
| `eip.orders.processing` | Orders entering the wire-tap main flow |
| `eip.orders.processed` | Orders after main-flow processing |
| `eip.orders.audit` | Audit copies from wire tap |
| `eip.orders.sequenced` | Resequenced order stream |
| `eip.orders.resequenced` | Orders after resequencing |
| `eip.orders.composed` | Orders with line items for composed message processing |
| `eip.orders.enriched` | Enriched orders after composed processing |
| `eip.orders.loadbalanced` | Orders entering the load balancer |

## How to test

The `DemoDataGenerator` automatically produces orders to the relevant Kafka topics every 5 seconds. Watch the logs to observe each pattern in action.

---

*Verification status: unverified.*
