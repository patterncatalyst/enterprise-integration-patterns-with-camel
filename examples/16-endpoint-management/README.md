# Chapter 16: Endpoint Management

Demonstrates four patterns for managing how application code interacts with messaging endpoints, covering API abstraction, content-based filtering, stale message cleanup, and wire-to-domain mapping.

- **Messaging Gateway** — `OrderMessagingGateway` CDI bean wraps `FluentProducerTemplate` behind domain methods (`publishOrderPlaced`, `requestInventoryCheck`) so application code never touches Camel APIs
- **Selective Consumer** — Inspects `containsHazmat` header and only accepts non-hazmat orders
- **Channel Purger** — Checks `orderTimestamp` header; messages older than 10 minutes are discarded as stale
- **Messaging Mapper** — `unmarshal().json(JsonLibrary.Jackson, Order.class)` maps wire JSON to a typed POJO; `OrderService.process()` works with domain objects

## Running

```bash
# From the repository root — start the infrastructure stack
./scripts/setup-stack.sh

# Start the example
cd examples/16-endpoint-management && mvn quarkus:dev
```

## Infrastructure

Kafka from the Podman stack.

## Data flow

```
Timer (5s) → eip.orders.placed → [Selective Consumer] → (hazmat? drop) → eip.orders.accepted
                                                                                ↓
                                                                         [Channel Purger]
                                                                         (stale? discard)
                                                                                ↓
                                                                         eip.orders.clean
                                                                                ↓
                                                                         [Messaging Mapper]
                                                                         (JSON → Order POJO)
                                                                                ↓
                                                                         OrderService.process()

Timer (8s) → [OrderMessagingGateway] → eip.orders.placed
                                     → eip.orders.inventory-request
```

## What to observe

1. **Demo data generator** — orders appear every 5s on `eip.orders.placed` with varying `contains_hazmat` and `shipping_priority` values; every 3rd order contains hazmat, every 4th has a stale timestamp (1 hour old)
2. **Selective consumer** — hazmat orders are dropped with a log entry; non-hazmat orders pass through to `eip.orders.accepted`
3. **Channel purger** — stale messages (timestamp older than 10 minutes) are discarded; only recent messages reach `eip.orders.clean`
4. **Messaging mapper** — JSON is unmarshalled into an `Order` POJO and handed to `OrderService.process()`; logs show the typed domain object being processed
5. **Messaging gateway** — every 8s the gateway publishes an order to `eip.orders.placed` and sends an inventory request to `eip.orders.inventory-request`; application code uses `publishOrderPlaced()` and `requestInventoryCheck()` with no direct Camel API exposure

## Kafka topics

| Topic | Description |
|---|---|
| `eip.orders.placed` | All incoming orders (from demo generator and gateway) |
| `eip.orders.accepted` | Non-hazmat orders accepted by selective consumer |
| `eip.orders.clean` | Recent messages that passed channel purger (non-stale) |
| `eip.orders.inventory-request` | Inventory check requests via gateway |

---

*Verification status: unverified.*
