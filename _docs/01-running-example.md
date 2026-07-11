---
title: "The Running Example"
order: 1
part: getting-started
description: "The shipping domain — orders, inventory, payments, shipments, and notifications — that drives every pattern example."
duration: "25 minutes"
---

Every pattern in this tutorial needs a problem to solve. Instead of inventing a new scenario for each chapter, we use a single **shipping domain** — five microservices that collaborate to move an order from placement through delivery. This gives you a consistent frame of reference: when you see a Content-Based Router in Part 5, it's routing the same `OrderPlaced` events you met here; when you see an Idempotent Receiver in Part 7, it's deduplicating the same payment confirmations.

This chapter introduces the domain model, the services, the message flows between them, and the infrastructure that carries those messages. By the end, you'll understand the business problem well enough to recognize it instantly in every pattern example that follows.

{% include excalidraw.html file="01-order-flow" alt="Diagram showing the five shipping domain services and the Kafka event flow between them" caption="Figure 1.1 — The shipping domain order flow" %}

## The business problem

A customer places an order on an e-commerce platform. Behind the scenes, five things need to happen — and they need to happen reliably, even when individual services are slow, down, or processing out of order:

1. **Record the order** and assign it a status.
2. **Check inventory** — is the item in stock? If so, reserve it.
3. **Process payment** — charge the customer.
4. **Schedule shipment** — pick a carrier, generate a tracking number.
5. **Notify the customer** — send order confirmation, shipping updates, delivery confirmation.

These five responsibilities belong to five independent services. They don't share a database, they don't call each other synchronously (with one exception we'll explore in Part 1), and they communicate exclusively through messages. That's what makes this domain a perfect fit for studying integration patterns: every interaction between services is a pattern in action.

## The five services

### order-service

The entry point for the domain. It receives HTTP requests to create orders, persists them to the `orders` schema in PostgreSQL, and emits an `OrderPlaced` event to Kafka. It also listens for status updates from downstream services and maintains the order lifecycle: `PLACED` → `PAID` → `SHIPPED` → `DELIVERED` (or `CANCELLED` at any point).

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `SERIAL` | Auto-generated primary key |
| `customer_id` | `VARCHAR(64)` | Who placed the order |
| `item_sku` | `VARCHAR(64)` | What they ordered |
| `quantity` | `INTEGER` | How many |
| `amount` | `DECIMAL(12,2)` | Total price |
| `status` | `VARCHAR(20)` | Current lifecycle state |
| `created_at` | `TIMESTAMP` | When the order was placed |

The `OrderPlaced` event carries all of these fields. Downstream services subscribe to this event and act on the information they need.

### inventory-service

Manages stock levels. When it receives an `OrderPlaced` event, it checks whether `quantity_on_hand` for the requested `item_sku` is sufficient. If so, it decrements stock (a reservation) and emits an `InventoryReserved` event. If not, it emits an `InventoryInsufficient` event, which triggers order cancellation upstream.

| Field | Type | Purpose |
|-------|------|---------|
| `sku` | `VARCHAR(64)` (PK) | Stock-keeping unit identifier |
| `quantity_on_hand` | `INTEGER` | Current available stock |

This is one of the simplest services, but it demonstrates a critical integration concern: **idempotency**. If the `OrderPlaced` event is delivered twice (which Kafka's at-least-once semantics allows), the inventory service must not double-decrement. We solve this with an Idempotent Receiver backed by Redis — a pattern you'll study in detail in Part 7.

### payment-service

Processes payments. It listens for `InventoryReserved` events (not `OrderPlaced` — payment only happens after stock is confirmed) and simulates a payment gateway call. On success, it emits `PaymentProcessed`; on failure, `PaymentFailed`. Refunds flow through the same service.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `SERIAL` | Auto-generated primary key |
| `order_id` | `INTEGER` | Which order this payment is for |
| `amount` | `DECIMAL(12,2)` | Amount charged |
| `status` | `VARCHAR(20)` | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED` |
| `created_at` | `TIMESTAMP` | When the charge was initiated |

The payment service illustrates **correlation**: it receives an event about inventory, must correlate it back to the original order, and emit a new event that downstream services can also correlate. The `order_id` field is the Correlation Identifier — a pattern from Part 4.

### shipping-service

Schedules carriers and tracks deliveries. It acts on `PaymentProcessed` events — no payment, no shipment. It assigns a carrier, generates a tracking number, and emits `ShipmentScheduled`. Later, it can emit `ShipmentDelivered` when the carrier confirms delivery.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `SERIAL` | Auto-generated primary key |
| `order_id` | `INTEGER` | Which order this shipment fulfills |
| `carrier` | `VARCHAR(64)` | Carrier name (FedEx, UPS, DHL, etc.) |
| `tracking_number` | `VARCHAR(128)` | Carrier-assigned tracking ID |
| `status` | `VARCHAR(20)` | `PENDING`, `SCHEDULED`, `IN_TRANSIT`, `DELIVERED` |
| `created_at` | `TIMESTAMP` | When the shipment was created |

The shipping service demonstrates the **Content-Based Router** pattern when selecting a carrier based on order properties (weight, destination, priority), and the **Recipient List** when notifying multiple tracking systems about a new shipment.

### notification-service

A pure consumer — it listens to events from all other services and sends customer-facing notifications (email, SMS, push). It doesn't emit domain events of its own. Instead, it acts as an **Event-Driven Consumer** (Part 7) that reacts to the entire event stream.

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `SERIAL` | Auto-generated primary key |
| `order_id` | `INTEGER` | Which order this notification is about |
| `event_type` | `VARCHAR(64)` | What triggered it (`ORDER_PLACED`, `PAYMENT_PROCESSED`, etc.) |
| `customer_id` | `VARCHAR(64)` | Who to notify |
| `item_sku` | `VARCHAR(64)` | What was ordered |
| `quantity` | `INTEGER` | How many |
| `amount` | `DECIMAL(12,2)` | Order total |
| `status` | `VARCHAR(20)` | Notification delivery status |
| `created_at` | `TIMESTAMP` | When the notification was created |

The notification service subscribes to a broad set of topics and uses a **Content-Based Router** to decide which notification template to use and which channel (email vs. SMS) to deliver through.

## The message flow

Here is the end-to-end flow for a successful order:

```
Customer ──HTTP POST──▶ order-service
                              │
                         OrderPlaced
                              │
                    ┌─────────┼─────────────┐
                    ▼                        ▼
          inventory-service         notification-service
                    │                   (order confirmed)
            InventoryReserved
                    │
                    ▼
          payment-service
                    │
            PaymentProcessed
                    │
                    ├──────────────────────┐
                    ▼                      ▼
          shipping-service        notification-service
                    │                (payment confirmed)
          ShipmentScheduled
                    │
                    ├──────────────────────┐
                    ▼                      ▼
            order-service         notification-service
          (status → SHIPPED)        (shipment details)
```

Every arrow in this diagram is a **message** flowing through a **channel** (a Kafka topic). Every service is a **message endpoint**. The entire flow is a **pipes and filters** architecture. You'll study each of these foundational patterns in Part 2.

### Failure paths

The happy path is clean, but failures reveal where integration patterns earn their keep:

- **Insufficient inventory** → `InventoryInsufficient` event → order-service cancels the order → notification-service sends "out of stock" email.
- **Payment failure** → `PaymentFailed` event → inventory-service releases the reserved stock → order-service cancels → notification-service sends "payment declined" email.
- **Shipping delay** → No `ShipmentDelivered` within SLA → a **Process Manager** (Part 5) escalates to customer service.
- **Duplicate event delivery** → Any service may receive the same event twice → **Idempotent Receiver** (Part 7) ensures at-most-once processing.
- **Service down** → Events queue in Kafka until the service recovers → **Guaranteed Delivery** (Part 3) ensures nothing is lost.

These failure paths aren't edge cases — they're where most of the integration complexity lives, and where the patterns in this tutorial provide their greatest value.

## Events and schemas

Every inter-service message is an **event** — a record of something that happened, not a command to do something. This is a deliberate design choice. Events are facts; they can be consumed by any number of subscribers without the publisher knowing or caring who's listening. This decoupling is the foundation of the **Publish-Subscribe** pattern (Part 3).

### Event catalog

| Event | Producer | Consumers | Kafka Topic |
|-------|----------|-----------|-------------|
| `OrderPlaced` | order-service | inventory, notification | `eip.orders.placed` |
| `OrderCancelled` | order-service | inventory, notification | `eip.orders.cancelled` |
| `InventoryReserved` | inventory-service | payment, notification | `eip.inventory.reserved` |
| `InventoryInsufficient` | inventory-service | order, notification | `eip.inventory.insufficient` |
| `PaymentProcessed` | payment-service | shipping, order, notification | `eip.payments.processed` |
| `PaymentFailed` | payment-service | inventory, order, notification | `eip.payments.failed` |
| `ShipmentScheduled` | shipping-service | order, notification | `eip.shipping.scheduled` |
| `ShipmentDelivered` | shipping-service | order, notification | `eip.shipping.delivered` |

### Topic naming convention

Topics follow the pattern `eip.<domain>.<event>`:
- `eip` — namespace prefix, keeps tutorial topics separated from anything else on the same broker.
- `<domain>` — the bounded context that owns the event (`orders`, `inventory`, `payments`, `shipping`).
- `<event>` — what happened, past tense, lowercase.

### Schema evolution with Avro

In a production system, event schemas evolve over time — fields get added, types change, old consumers need to keep working. We use **Apache Avro** schemas registered in **Apicurio Registry** to enforce compatibility. Each event has a `.avsc` schema file that defines its structure:

```json
{
  "type": "record",
  "name": "OrderPlaced",
  "namespace": "eip.order.v1",
  "fields": [
    {"name": "order_id",    "type": "int"},
    {"name": "customer_id", "type": "string"},
    {"name": "item_sku",    "type": "string"},
    {"name": "quantity",    "type": "int"},
    {"name": "amount",      "type": {"type": "bytes", "logicalType": "decimal",
                                      "precision": 12, "scale": 2}},
    {"name": "status",      "type": "string"},
    {"name": "created_at",  "type": {"type": "long",
                                      "logicalType": "timestamp-millis"}}
  ]
}
```

Apicurio enforces **backward compatibility** by default: new schema versions can add fields with defaults but cannot remove or rename existing fields. This means a consumer built against schema v1 can still read messages produced with schema v2 — a critical property for zero-downtime deployments.

Camel integrates with Apicurio through the `camel-kafka` component's serializer/deserializer configuration. You'll see this wiring in every Kafka-based example.

{% include excalidraw.html file="01-stack-architecture" alt="Diagram showing the local infrastructure stack — Kafka, Pulsar, Redis, PostgreSQL, Apicurio, and the LGTM observability overlay" caption="Figure 1.2 — Local stack architecture" %}

## The infrastructure

The services don't exist in isolation — they depend on shared infrastructure that carries messages, stores state, and provides observability. You set this up in the previous chapter; here's how each piece fits into the domain.

### Apache Kafka — the message backbone

Kafka is the primary message broker. Every event in the catalog flows through a Kafka topic. We use Kafka in KRaft mode (no ZooKeeper) with three partitions per topic by default — enough to demonstrate parallel consumption without overwhelming a laptop.

**Why Kafka?** Kafka's durable, partitioned log model is ideal for event-driven architectures. Events are retained (not consumed-and-deleted), so a new service can replay history. Consumer groups provide built-in load balancing. And Kafka's at-least-once delivery guarantee, combined with idempotent producers and transactional support, covers the reliability requirements of all 65 patterns.

### Apache Pulsar — the alternative broker

Pulsar appears in specific chapters where its features offer a clearer demonstration of a pattern. Pulsar's subscription model (exclusive, shared, failover, key-shared) maps more directly to some EIP patterns than Kafka's consumer group model. We use Pulsar for:

- **Competing Consumers** (Part 7) — Pulsar's shared subscription is a textbook implementation.
- **Message Expiration** (Part 4) — Pulsar's per-message TTL is more granular than Kafka's segment-level retention.
- **Dead Letter Channel** (Part 3) — Pulsar has native dead-letter topic support with configurable retry counts.

### Redis — caching, deduplication, and the claim check

Redis serves three distinct roles in the domain:

1. **Idempotent Repository** — A Redis set stores processed message IDs so that duplicate deliveries are detected and skipped. Used by inventory-service and payment-service.
2. **Claim Check Store** — When a message payload is too large for the broker (e.g., a PDF shipping label), the payload is stored in Redis and replaced with a reference key. The receiver retrieves the full payload from Redis using the key.
3. **Caching** — Inventory levels, carrier rate tables, and other frequently-read data are cached in Redis to avoid repeated database queries during high-volume processing.

### PostgreSQL — persistence and aggregation

Each service has its own schema in the shared PostgreSQL instance (in production, these would be separate databases). PostgreSQL also serves as the backing store for two Camel patterns:

- **Aggregation Repository** — When a Camel aggregator collects messages over time (e.g., batching shipment updates), the in-progress aggregation state is persisted to PostgreSQL so it survives restarts.
- **Message Store** — The Wire Tap and Message History patterns write copies of messages to PostgreSQL for auditing and debugging.

### Apicurio Registry — schema governance

Apicurio Registry stores and versions Avro schemas. Kafka producers serialize events using schemas fetched from the registry; consumers deserialize with the same schemas. This ensures that every service agrees on the structure of every event, even as schemas evolve independently.

## Putting it together

When you run the examples in later chapters, you'll follow a consistent pattern:

1. **Start the stack** — `./scripts/setup-stack.sh` (or `--lgtm` for observability).
2. **Run the route** — Most pattern examples are single route files that you run directly with the Camel CLI:

   ```bash
   camel run content-based-router.yaml --dev
   ```

   The `--dev` flag enables live reload — edit the route file and Camel restarts automatically. No Maven project, no build step, no waiting. For examples that need additional dependencies (like `camel-kafka` or `camel-sql`), the CLI resolves them automatically from the route file's imports.

3. **Inspect the route** — Use `camel get` to see active routes and endpoints, `camel trace` to watch messages flow through, or `camel top` for live throughput metrics.
4. **Produce a trigger** — Send an HTTP request, publish a message to a Kafka topic using the Kafka UI at `http://localhost:8090`, or drop a file into a watched directory.
5. **Observe the flow** — Watch the Camel logs, check the database, browse Kafka topics in the UI, or (with the LGTM stack) trace the message flow across services in Grafana.

For the full-stack case studies and multi-service examples, you'll use the promoted Quarkus projects in `examples/`:

```bash
cd examples/09-routing-fundamentals
mvn quarkus:dev
```

The Camel CLI's `camel export --runtime=quarkus` command is how these promoted projects were created — a single route file becomes a full Quarkus application with CDI, configuration, container packaging, and all the production concerns that a prototype doesn't need.

Every pattern chapter follows this loop: understand the pattern, see how Camel implements it, run it with `camel run`, and observe what happens. The domain is simple enough that the patterns stay in focus, but rich enough that the examples feel real.

## What you learned

- The shipping domain: five services (order, inventory, payment, shipping, notification) collaborating through events.
- The event catalog: eight event types flowing through Kafka topics with Avro schemas.
- How each infrastructure component (Kafka, Pulsar, Redis, PostgreSQL, Apicurio) serves the domain.
- The consistent loop you'll follow in every pattern chapter: start, trigger, observe.

Next, we step back and look at the big picture — the four fundamental ways applications can share data — before diving into the messaging patterns that this tutorial is built around.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Avro schema example is structurally valid; topic naming convention matches what the example code actually produces; the message flow diagram accurately reflects the event choreography once services are implemented.*
