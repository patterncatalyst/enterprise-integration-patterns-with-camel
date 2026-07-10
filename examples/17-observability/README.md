# Chapter 17: System Management

Demonstrates system management and observability patterns with Apache Camel on Quarkus:

- **Control Bus** — exposes REST endpoints to start, stop, and query the status of routes at runtime via the `controlbus` component
- **Wire Tap** — taps order processing to send a copy of each message to an audit log topic without affecting the main flow
- **Message History** — enables message history tracking and logs the full route path each exchange has traversed

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../17-observability
mvn quarkus:dev
```

## Data flow

```
eip.orders.placed → [Wire Tap Processor] → eip.orders.processed
                           ↓
                    eip.orders.audit

eip.orders.incoming → [Validate] → [Enrich] → [Log History] → eip.orders.processed

REST /control/status/{routeId} → [Control Bus] → route status
REST /control/stop/{routeId}   → [Control Bus] → stop route
REST /control/start/{routeId}  → [Control Bus] → start route
```

## How to test

**Wire Tap** — produce an order to `eip.orders.placed`:

```json
{"order_id": 7001, "customer_id": "C-400", "item_sku": "SKU-WW", "quantity": 1, "amount": 59.99}
```

The order flows to `eip.orders.processed` and a copy appears on `eip.orders.audit`.

**Message History** — produce an order to `eip.orders.incoming`:

```json
{"order_id": 7002, "customer_id": "C-401", "item_sku": "SKU-HH", "quantity": 3, "amount": 99.99}
```

Watch the logs for the full route path (e.g., `message-history-demo@... -> history-validate@... -> history-enrich@... -> history-logger@...`).

**Control Bus** — query and manage routes via REST:

```bash
curl http://localhost:8080/control/status/wiretap-order-processor
curl -X POST http://localhost:8080/control/stop/wiretap-order-processor
curl -X POST http://localhost:8080/control/start/wiretap-order-processor
```

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.placed` | Incoming orders for wire tap demo |
| `eip.orders.processed` | Successfully processed orders |
| `eip.orders.audit` | Audit log copies via wire tap |
| `eip.orders.incoming` | Incoming orders for message history demo |

---

*Verification status: unverified.*
