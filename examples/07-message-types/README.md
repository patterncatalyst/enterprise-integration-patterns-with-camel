# Chapter 7: Message Types

Demonstrates the three fundamental message types with Apache Camel on Quarkus:

- **Command Message** — a directive telling the receiver to _do something_ (ProcessPayment), sent point-to-point on `eip.commands.process-payment`
- **Document Message** — a self-contained data record (full order document) published to `eip.documents.orders`, with no implied action
- **Event Message** — a notification that _something happened_ (OrderPlaced), published as a structured envelope to `eip.events.orders`

## Running

```bash
cd examples/_infra && ./../../scripts/setup-stack.sh
cd ../07-message-types
mvn quarkus:dev
```

Watch the logs to see each message type produced and consumed:
- Commands are executed and produce a result status
- Documents are received and their contents logged
- Events are observed and recorded with no reply

## Kafka topics

| Topic | Type | Description |
|-------|------|-------------|
| `eip.commands.process-payment` | Command | Point-to-point payment processing commands |
| `eip.documents.orders` | Document | Full order data records |
| `eip.events.orders` | Event | Order lifecycle event notifications |

---

*Verification status: unverified.*
