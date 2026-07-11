# Chapter 6: Channel Infrastructure

Demonstrates channel-level infrastructure patterns with Apache Camel on Quarkus:

- **Channel Adapter** — inbound REST endpoint publishes orders to Kafka; outbound consumer dispatches fulfilled orders to an external system (simulated)
- **Messaging Bridge** — forwards orders from one Kafka topic to another, simulating a cross-system bridge (e.g., Kafka to Pulsar)
- **Message Bus** — multiple independent services (inventory, payment, notification, fulfillment) consume from shared Kafka topics with separate consumer groups

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../06-channel-infra
mvn quarkus:dev
```

Orders are generated automatically every 5 seconds. You can also submit orders via the inbound channel adapter:

```bash
curl -X POST http://localhost:8080/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"order_id": 999, "item": "WIDGET-042", "quantity": 3, "status": "NEW"}'
```

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.incoming` | Orders arriving via REST adapter or timer generator |
| `eip.orders.bridged` | Orders forwarded by the messaging bridge |
| `eip.orders.fulfilled` | Orders marked fulfilled by the fulfillment service |

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
