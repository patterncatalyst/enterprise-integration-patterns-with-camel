---
title: "Message Types"
order: 7
part: message-construction
description: "Command, document, and event messages — the three semantic types that determine what a message means and how the receiver should handle it."
duration: "30 minutes"
---

So far, we've treated messages as generic packets of data. But messages carry intent — they tell the receiver to *do* something, *inform* it of data, or *notify* it that something happened. These three semantic types — command, document, and event — fundamentally shape how the sender and receiver relate to each other. Choosing the right type determines your system's coupling, error handling, and evolution characteristics.

This chapter and the next cover Message Construction: what goes *inside* a message and what metadata accompanies it. We start here with the three message types, then move to metadata patterns — request-reply, correlation, sequencing, and expiration — in the next chapter.

## Pattern: Command Message

### What it is

A **Command Message** tells the receiver to do something: "reserve inventory for this order," "process this payment," "schedule this shipment." The sender has a specific action in mind and expects the receiver to carry it out.

Commands are:
- **Directed** — Sent to a specific receiver (or a pool of receivers that compete for work). You wouldn't broadcast a "charge this credit card" command to every service.
- **Imperative** — Named as verbs: `ReserveInventory`, `ProcessPayment`, `ScheduleShipment`.
- **Expecting a result** — The sender usually cares whether the command succeeded. This often implies a request-reply pattern (next chapter).

### Shipping domain example

When inventory-service confirms that stock is available, it could send a `ProcessPayment` command to payment-service:

```json
{
  "command": "ProcessPayment",
  "order_id": 42,
  "customer_id": "CUST-100",
  "amount": 149.99,
  "currency": "USD"
}
```

This tells payment-service exactly what to do. Payment-service doesn't decide *whether* to process the payment — that decision was made upstream. It just executes.

### How Camel models it

Commands typically flow through **point-to-point channels** (a Kafka topic with a single consumer group) because you want exactly one receiver to execute the command:

```java
// Sending a command
from("direct:send-payment-command")
    .routeId("command-message-sender")
    .setHeader("messageType", constant("COMMAND"))
    .setHeader("commandName", constant("ProcessPayment"))
    .marshal().json()
    .to("kafka:eip.payments.commands?brokers=localhost:9092&key=${header.orderId}");

// Receiving and executing the command
from("kafka:eip.payments.commands?brokers=localhost:9092&groupId=payment-service")
    .routeId("command-message-receiver")
    .unmarshal().json(Map.class)
    .log("Executing command: ${body[command]} for order ${body[order_id]}")
    .to("direct:execute-payment")
    // Send result back (request-reply — covered next chapter)
    .to("kafka:eip.payments.results?brokers=localhost:9092");
```

### Trade-offs of command messages

Commands create **behavioral coupling**: the sender knows *what the receiver does* and depends on that behavior. If payment-service changes how it processes payments, the sender may need to adjust (different fields, different error codes, different semantics). This coupling is tighter than event messages but sometimes necessary — when you need to guarantee a specific action was taken.

## Pattern: Document Message

### What it is

A **Document Message** carries data from the sender to the receiver without prescribing any action. It says "here is the information" and lets the receiver decide what to do with it. The sender transfers data, not intent.

Documents are:
- **Data-centric** — Named as nouns: `OrderRecord`, `CustomerProfile`, `InventorySnapshot`.
- **No implied action** — The receiver might display it, store it, analyze it, or ignore it.
- **Often batch-oriented** — Exporting a set of records, synchronizing a data snapshot, populating a report.

### Shipping domain example

The nightly accounting export from Part 1 (Integration Styles) is a document message. Order-service sends order records to the accounting system — not as commands ("process these orders") but as data ("here are the orders"):

```json
{
  "type": "OrderRecord",
  "data": {
    "order_id": 42,
    "customer_id": "CUST-100",
    "item_sku": "SKU-ABC-42",
    "quantity": 2,
    "amount": 149.99,
    "status": "SHIPPED",
    "shipped_at": "2026-07-10T14:30:00Z"
  }
}
```

The accounting system decides what to do: reconcile revenue, update the ledger, flag discrepancies. Order-service doesn't know or care.

### How Camel models it

Document messages often involve data format transformation — the sender's internal format rarely matches what the receiver needs:

```java
// Send a batch of order documents to the accounting channel
from("timer:accounting-export?period=86400000")
    .routeId("document-message")
    .to("sql:SELECT * FROM orders.orders WHERE status IN ('SHIPPED','DELIVERED') "
        + "AND created_at > CURRENT_DATE - INTERVAL '1 day'"
        + "?dataSource=#orderDataSource")
    .split(body())
        .marshal().json()
        .setHeader("messageType", constant("DOCUMENT"))
        .setHeader("documentType", constant("OrderRecord"))
        .to("kafka:eip.accounting.orders?brokers=localhost:9092")
    .end()
    .log("Exported ${header.CamelSplitSize} order documents to accounting");
```

## Pattern: Event Message

### What it is

An **Event Message** announces that something happened: "an order was placed," "payment was processed," "a shipment was delivered." It's a statement of fact — an immutable record of a past occurrence. The sender doesn't tell the receiver what to do; it just says what happened and lets any interested party react as they see fit.

Events are:
- **Past tense** — Named as past participles: `OrderPlaced`, `PaymentProcessed`, `ShipmentDelivered`.
- **Immutable** — Once emitted, an event doesn't change. You can emit a new event that corrects or supersedes it, but the original stands.
- **Publish-subscribe** — Events are broadcast to all interested subscribers. The sender doesn't know who's listening.
- **No expected response** — The sender fires and forgets. It doesn't wait for a result, doesn't expect acknowledgment, and doesn't care if zero or a hundred consumers process the event.

### Why our domain uses events

The shipping domain is event-driven by design. Every inter-service message is an event, not a command:

| Event Style | Command Style (avoided) |
|------------|------------------------|
| `OrderPlaced` → inventory-service decides to check stock | `CheckInventory` → inventory-service is told what to do |
| `InventoryReserved` → payment-service decides to charge | `ProcessPayment` → payment-service is told what to do |
| `PaymentProcessed` → shipping-service decides to ship | `ScheduleShipment` → shipping-service is told what to do |

The event style is more decoupled:
- **Adding a consumer changes nothing.** When we add analytics-service, we just subscribe to existing events. No changes to any producer.
- **The producer doesn't orchestrate.** Order-service doesn't need to know the correct sequence (check inventory → charge → ship). Each service reacts to the events it cares about.
- **Failure is local.** If payment-service is down, `InventoryReserved` events queue in Kafka. Inventory-service and notification-service are unaffected. With commands, the orchestrator (order-service) would need to handle the failure.

### How Camel models it

The `OrderPlaced` event from Chapter 02 is the canonical example. Here it is with explicit event metadata:

```java
from("direct:emit-order-placed")
    .routeId("event-message")
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        Map<String, Object> event = new java.util.LinkedHashMap<>();
        event.put("event_type", "OrderPlaced");
        event.put("event_id", java.util.UUID.randomUUID().toString());
        event.put("event_time", java.time.Instant.now().toString());
        event.put("source", "order-service");
        event.put("data", order);
        exchange.getIn().setBody(event);
    })
    .setHeader("messageType", constant("EVENT"))
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092&key=${header.orderId}")
    .log("Event emitted: OrderPlaced for order ${header.orderId}");
```

The event envelope includes metadata that helps consumers process and debug:
- `event_type` — What happened.
- `event_id` — Unique identifier for deduplication (used by the Idempotent Receiver in Part 7).
- `event_time` — When it happened (the business time, not the Kafka append time).
- `source` — Which service emitted it.
- `data` — The event payload.

## Choosing between the three types

| Dimension | Command | Document | Event |
|-----------|---------|----------|-------|
| **Intent** | "Do this" | "Here's the data" | "This happened" |
| **Coupling** | Behavioral (sender knows what receiver does) | Structural (sender shares data format) | Minimal (sender doesn't know receivers) |
| **Direction** | Point-to-point | Point-to-point or broadcast | Broadcast (pub-sub) |
| **Response expected** | Usually yes (request-reply) | Usually no | No |
| **Naming** | Imperative verb (`ReserveInventory`) | Noun (`OrderRecord`) | Past participle (`OrderPlaced`) |
| **Best for** | Orchestration, explicit workflows | Data transfer, ETL, sync | Choreography, event-driven architecture |

### When to use each

**Commands** when you need to guarantee a specific action is taken and you want the result back. Use sparingly — they create behavioral coupling.

**Documents** when you're transferring data without prescribing action. Reports, exports, data synchronization, reference data distribution.

**Events** when you want loose coupling and don't care who reacts or how. This is the default in event-driven microservices — and the default in our shipping domain.

### Hybrid patterns

Real systems often mix types. Our shipping domain is mostly events, but the checkout flow uses a command-style RPI call to get a shipping estimate (Part 1). The nightly accounting export is a document flow. The key is to choose deliberately, not by accident.

## Common pitfalls

**Commands disguised as events.** If `OrderPlaced` is only consumed by inventory-service, and inventory-service is the *only* thing that should react, you've built a command with event naming. This isn't necessarily wrong — but be honest about the coupling. If you later add a second consumer and it causes problems, the event naming misled you.

**Events with command semantics.** If inventory-service emits `InventoryReserved` and payment-service treats it as "I must now charge the customer" — that's fine, that's choreography. But if payment-service would break if it *didn't* process the event, you've created an implicit command. Make sure the dependency is understood and documented.

**Missing event metadata.** Events without `event_id`, `event_time`, and `source` are harder to debug, deduplicate, and replay. Include these fields from the start — adding them later means migrating all consumers.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 5: "Message Construction"
- [enterpriseintegrationpatterns.com — Command Message](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CommandMessage.html)
- [enterpriseintegrationpatterns.com — Document Message](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DocumentMessage.html)
- [enterpriseintegrationpatterns.com — Event Message](https://www.enterpriseintegrationpatterns.com/patterns/messaging/EventMessage.html)

## What you learned

- **Command Messages** direct the receiver to perform a specific action — highest coupling, used for orchestrated workflows.
- **Document Messages** transfer data without implying action — used for batch exports, data sync, and reference data.
- **Event Messages** announce facts about what happened — lowest coupling, the foundation of event-driven architecture and the default in our shipping domain.
- The choice between types determines coupling, error handling, and how the system evolves as you add new services.

Next, we look at the metadata that accompanies messages: request-reply, correlation identifiers, message sequences, expiration, and format indicators.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: timer component `period` parameter is in milliseconds and accepts the value shown; SQL component inline query syntax with date intervals works in PostgreSQL; event envelope structure is consistent with what the example code produces.*
