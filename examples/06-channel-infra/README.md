# Chapter 6: Channel Infrastructure

Demonstrates channel-level infrastructure patterns with Apache Camel on Quarkus:

- **Channel Adapter** — inbound REST endpoint persists orders to PostgreSQL and publishes to Kafka; outbound consumer dispatches fulfilled orders to an external system (simulated)
- **Messaging Bridge** — bidirectional Kafka↔Pulsar bridge: partner orders flow from Pulsar to Kafka, shipping events flow from Kafka to Pulsar
- **Message Bus** — multiple independent services (inventory, payment, notification, fulfillment) consume from shared Kafka topics with separate consumer groups

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../06-channel-infra
mvn quarkus:dev
```

Orders are generated automatically every 5 seconds. You can also submit orders via the inbound channel adapter:

```bash
curl -X POST http://localhost:8082/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"order_id": 999, "item": "WIDGET-042", "quantity": 3, "status": "NEW"}'
```

## Infrastructure

Requires the full Podman stack (Kafka + Pulsar + PostgreSQL):

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
```

## Topics and services

| System | Topic/Table | Description |
|--------|-------------|-------------|
| Kafka | `eip.orders.incoming` | Orders arriving via REST adapter or timer |
| Kafka | `eip.orders.fulfilled` | Orders marked fulfilled by fulfillment service |
| Kafka | `eip.shipping.scheduled` | Shipping events bridged to Pulsar |
| Pulsar | `partner.orders.placed` | Partner orders bridged to Kafka |
| PostgreSQL | `orders.orders` | Orders persisted by inbound channel adapter |

## Data flow

```
Timer / REST  -->  eip.orders.incoming  --+--> inventory-service   (Message Bus)
                                          +--> payment-service     (Message Bus)
                                          +--> notification-service(Message Bus)
                                          +--> Messaging Bridge  -->  eip.orders.bridged
                                                                        |
                                                                   fulfillment-service
                                                                        |
                                                                   eip.orders.fulfilled
                                                                        |
                                                                   Outbound Channel Adapter
```

---

*Verification status: unverified.*
