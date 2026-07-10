---
title: "Integration Styles"
order: 2
part: integration-styles
description: "The four fundamental ways applications share data — file transfer, shared database, remote procedure invocation, and messaging."
duration: "45 minutes"
---

Before we dive into messaging patterns, we need to understand *why messaging exists at all*. Gregor Hohpe and Bobby Woolf open the EIP book with a deceptively simple question: how do you get two applications to share data? There are exactly four fundamental approaches — four **integration styles** — and each one trades off differently along the axes of coupling, timeliness, reliability, and complexity. Understanding these trade-offs is essential, because every decision you make in the rest of this tutorial builds on the choice of messaging as the primary integration style.

This chapter walks through all four styles, shows how each one would solve a problem from our shipping domain, implements each in Apache Camel, and explains when you'd choose one over another. By the end, you'll understand not just *what* messaging is, but *why* it's the right default for loosely coupled systems.

{% include excalidraw.html file="02-integration-styles" alt="Diagram showing the four integration styles side by side — File Transfer, Shared Database, RPI, and Messaging" caption="Figure 2.1 — The Four Integration Styles" %}

## Pattern 1: File Transfer

### The problem

The order-service needs to send a daily batch of completed orders to an external accounting system for revenue reconciliation. The accounting system is maintained by a different team, runs on a different schedule, and can't accept real-time API calls. It expects a CSV file dropped into a shared directory every night at midnight.

This is one of the oldest integration patterns in computing. It's simple, reliable, and requires almost no coordination between the two systems. The producer writes a file; the consumer reads it — on its own schedule, using its own tools.

### The solution

**File Transfer** works by having one application produce a file in an agreed-upon format and location, and the other application consume it. The file system (local, NFS, SFTP, S3, or any shared storage) acts as the intermediary. Neither application needs to know anything about the other's technology stack, programming language, or runtime schedule.

The key characteristics of file transfer:

- **Loose coupling** — The producer and consumer are completely independent. They agree on a file format and a location, nothing more.
- **Eventual consistency** — Data is only available when the file is written and read. There's an inherent delay — seconds, minutes, or hours — between when data is produced and when it's consumed.
- **Simple error handling** — If the consumer fails to process a file, the file is still there. Retry is as simple as re-reading it.
- **No backpressure** — The producer writes at its own pace; the consumer reads at its own pace. Neither can overwhelm the other.

The downsides are equally clear:

- **Latency** — File transfer is inherently batch-oriented. If you need data in real time, files are too slow.
- **Format agreement** — Both sides must agree on the file format (CSV, JSON, XML, fixed-width) and evolve it carefully. There's no schema registry, no automatic compatibility checking.
- **Duplicate processing** — Without a mechanism to track which files have been processed, the consumer may re-process the same file after a restart. Camel handles this with its idempotent consumer built into the file component.
- **Coordination** — Someone has to manage the shared directory: permissions, disk space, cleanup of old files, monitoring for stuck files.

### How Camel implements it

Camel's `file` and `ftp`/`sftp` components make file-based integration trivial. A Camel route can poll a directory for new files, process them, and move them to a "done" directory — all in a few lines.

Here's a route that reads completed orders from a CSV file, transforms each row, and sends it to the accounting system's input directory:

```java
from("file:data/orders/outbound?noop=true&include=.*\\.csv")
    .routeId("file-transfer-export")
    .log("Processing order file: ${header.CamelFileName}")
    .split(body().tokenize("\n")).streaming()
        .filter(simple("${body} != '' && !${body.startsWith('order_id')}"))
        .unmarshal().csv()
        .process(exchange -> {
            List<String> row = exchange.getIn().getBody(List.class);
            Map<String, Object> order = Map.of(
                "order_id", row.get(0),
                "customer_id", row.get(1),
                "item_sku", row.get(2),
                "amount", row.get(4),
                "status", row.get(5)
            );
            exchange.getIn().setBody(order);
        })
        .marshal().json()
        .to("file:data/accounting/inbound?fileName=${date:now:yyyyMMdd}-${header.CamelSplitIndex}.json")
    .end();
```

You can run any of these directly with the Camel CLI — no Maven project needed:

```bash
# Save the YAML route to a file and run it
camel run file-transfer-export.yaml --dev
```

The `--dev` flag gives you live reload: edit the route, save, and Camel restarts automatically. This is how you'll prototype every pattern in this tutorial.

**What this route does:**

1. **Polls** `data/orders/outbound/` for CSV files. The `noop=true` option means files are read but not moved or deleted — useful for testing; in production you'd use `move=.done` to prevent reprocessing.
2. **Splits** each file line by line with streaming enabled (so we don't load the entire file into memory).
3. **Filters** out the header row and empty lines.
4. **Unmarshals** each CSV line into a list of fields, transforms it into a JSON map with the fields the accounting system needs.
5. **Writes** each transformed record as a JSON file to the accounting system's inbound directory.

Camel's file component handles the filesystem details you'd otherwise code by hand: atomic file writes (write to a temp file, then rename), file locking to prevent concurrent access, configurable polling intervals, and the idempotent consumer to prevent duplicate processing.

### When to use file transfer

File transfer is the right choice when:
- The consumer runs on a different schedule than the producer (nightly batch jobs, weekly reports).
- The integration crosses organizational boundaries where API access isn't feasible.
- The data volume is large and batch processing is more efficient than record-by-record.
- You're integrating with legacy systems that only support file-based input.

It's the *wrong* choice when you need real-time data, when the format needs to evolve frequently, or when you need acknowledgment that the data was received and processed.

## Pattern 2: Shared Database

### The problem

The order-service and inventory-service both need access to the current stock level for a given SKU. When a customer places an order, order-service needs to show whether the item is in stock *before* accepting the order. Inventory-service owns the stock data. The simplest solution: let both services read from the same `inventory.stock` table.

### The solution

**Shared Database** means multiple applications read from and write to the same database (or at least the same tables). There's no intermediary, no message passing, no file exchange — just SQL. Both applications see the same data at the same time, with the database providing transactional consistency, locking, and conflict resolution.

The appeal is obvious:

- **Instant consistency** — The moment inventory-service decrements stock, order-service sees the new value. No propagation delay, no eventual consistency.
- **Transactional integrity** — The database enforces ACID guarantees. Two concurrent orders for the last item in stock won't both succeed — the database's row-level locks prevent it.
- **No translation** — Both applications work with the same schema, the same types, the same SQL. There's no serialization/deserialization, no format mismatch.
- **Familiar tooling** — Every developer knows SQL. Every ops team knows how to back up, replicate, and monitor a database.

The problems are equally well-known:

- **Tight coupling** — If inventory-service needs to change its schema (rename a column, split a table, change a type), it breaks order-service. Both teams must coordinate schema changes, which in practice means neither team changes the schema unless forced.
- **Performance coupling** — A slow query in order-service can lock rows that inventory-service needs. A bulk import in inventory-service can saturate the connection pool that order-service shares. The database becomes a shared bottleneck.
- **Scaling wall** — You can't scale the two services independently. They're bound to the same database instance. Horizontal scaling requires either database sharding (complex) or read replicas (eventually consistent, which defeats the purpose).
- **Hidden dependencies** — There's no explicit contract between the services. The contract is the schema — but schemas are rarely designed with multi-service access in mind. Views and stored procedures help, but they add maintenance burden.

### How Camel implements it

Even though shared database is generally an anti-pattern in microservices architecture, Camel makes it straightforward when you need it — and it's a common reality in brownfield systems. Here's a route where order-service checks inventory directly via SQL before accepting an order:

```java
from("direct:check-inventory")
    .routeId("shared-db-inventory-check")
    .setHeader("itemSku", simple("${body[item_sku]}"))
    .setHeader("requestedQty", simple("${body[quantity]}"))
    .to("sql:SELECT quantity_on_hand FROM inventory.stock WHERE sku = :#itemSku"
        + "?dataSource=#inventoryDataSource")
    .choice()
        .when(simple("${body[0][quantity_on_hand]} >= ${header.requestedQty}"))
            .log("Stock available: ${header.itemSku} has ${body[0][quantity_on_hand]} units")
            .setBody(constant(true))
        .otherwise()
            .log("Insufficient stock for ${header.itemSku}")
            .setBody(constant(false))
    .end();
```

**What this route does:**

1. Receives an order body on the `direct:check-inventory` endpoint (an in-memory synchronous call from another route).
2. Extracts the `item_sku` and `quantity` from the order body into headers.
3. Queries the `inventory.stock` table directly — this is the shared database access, where order-service reaches into inventory-service's schema.
4. Uses a content-based choice to return `true` (stock available) or `false` (insufficient).

The `sql` component uses named parameters (`:#itemSku`) bound from Camel headers, which prevents SQL injection. The `dataSource` parameter references a JDBC DataSource configured in `application.properties`.

### Why we move away from it

In our shipping domain, we *don't* use shared database for the production flow. Instead, order-service publishes an `OrderPlaced` event and inventory-service responds asynchronously. The shared database approach is shown here because it's what many systems start with — and understanding its limitations is what motivates the move to messaging.

The tipping point usually comes when:
- The inventory team needs to change their schema and realizes they can't without coordinating with every consumer.
- A slow analytics query in a reporting service locks inventory rows and causes order timeouts.
- You try to deploy inventory-service to a new region and discover it's inseparable from the database.

## Pattern 3: Remote Procedure Invocation (RPI)

### The problem

A customer is on the checkout page, and the UI needs to show a real-time shipping cost estimate. The order-service needs to ask shipping-service "how much would it cost to ship this item to this address?" and get an answer *right now* — before the page renders. There's no time for an asynchronous event; the customer is waiting.

### The solution

**Remote Procedure Invocation** makes a function call to another application across the network. The caller sends a request and blocks (or awaits) until the response arrives. From the developer's perspective, it looks like a local function call — but underneath, it's a network round trip with serialization, deserialization, network latency, and the possibility of failure.

RPI comes in many flavors:
- **REST/HTTP** — JSON over HTTP, the most common form today.
- **gRPC** — Protocol Buffers over HTTP/2, strongly typed, efficient binary serialization.
- **GraphQL** — Query language over HTTP, client specifies the exact data shape.
- **SOAP/WSDL** — XML over HTTP, with formal contracts (the original web service pattern).
- **Java RMI, CORBA, DCOM** — Older RPC protocols, largely replaced by REST and gRPC.

The advantages of RPI:

- **Synchronous** — The caller gets an immediate response. This is essential for user-facing interactions where latency matters.
- **Strong contracts** — With gRPC or OpenAPI, both sides agree on the request/response format. Tooling can generate client code automatically.
- **Familiar model** — Developers think in functions and return values. RPI maps directly to that mental model.

The disadvantages:

- **Temporal coupling** — Both services must be running at the same time. If shipping-service is down, order-service can't get a shipping estimate. You can mitigate this with circuit breakers and fallbacks, but the fundamental dependency remains.
- **Location coupling** — The caller must know where the service lives (its URL, host, port). Service discovery and load balancing add infrastructure complexity.
- **Cascading failures** — A slow downstream service ties up threads in the caller. If shipping-service takes 30 seconds to respond, order-service's thread pool fills up and *all* requests slow down — not just the ones that need shipping estimates.
- **Synchronous = blocking** — The caller waits. In a chain of three services (A calls B calls C), the total latency is the sum of all three. In messaging, each service processes independently.

### How Camel implements it

Camel supports both sides of RPI: making outbound HTTP calls with the `http` or `rest` component, and exposing REST endpoints with the `platform-http` component (which integrates with Quarkus's built-in HTTP server).

Here's a route where order-service calls shipping-service's REST API to get a shipping estimate:

```java
from("direct:get-shipping-estimate")
    .routeId("rpi-shipping-estimate")
    .setHeader(Exchange.HTTP_METHOD, constant("POST"))
    .setHeader(Exchange.CONTENT_TYPE, constant("application/json"))
    .marshal().json()
    .circuitBreaker()
        .resilience4jConfiguration()
            .failureRateThreshold(50)
            .waitDurationInOpenState(10000)
            .slidingWindowSize(5)
        .end()
        .to("http://localhost:8084/api/shipping/estimate"
            + "?httpMethod=POST"
            + "&connectTimeout=2000"
            + "&socketTimeout=5000")
        .unmarshal().json()
    .onFallback()
        .log("Shipping service unavailable — using flat rate fallback")
        .setBody(constant(Map.of("carrier", "STANDARD", "cost", 9.99, "fallback", true)))
    .end();
```

**What this route does:**

1. Receives a request on the `direct:get-shipping-estimate` endpoint (in-process call from another route).
2. Sets the HTTP method and content type headers, marshals the body to JSON.
3. Wraps the outbound call in a **circuit breaker** (Resilience4j). If shipping-service fails more than 50% of the time within a sliding window of 5 calls, the circuit opens and all subsequent calls go directly to the fallback for 10 seconds — without hitting the network.
4. Makes a POST to shipping-service's REST API with a 2-second connect timeout and 5-second read timeout.
5. On success, unmarshals the JSON response (carrier, cost, estimated delivery).
6. On failure (timeout, 5xx, circuit open), returns a flat-rate fallback estimate so the checkout page can still render.

The circuit breaker is the critical piece. Without it, a failing shipping-service would cause every checkout request to wait 5 seconds before timing out — and with a thread-per-request model, that quickly exhausts the server's thread pool. The circuit breaker *fails fast* and protects the caller.

### When to use RPI

RPI is the right choice when:
- The caller needs a response before it can continue (user-facing latency constraints).
- The interaction is naturally request-response (query, calculation, validation).
- Both services are always available (or you can tolerate fallback behavior).

It's the wrong choice for fire-and-forget operations, for interactions that can tolerate latency, or for cases where the caller shouldn't be affected by the responder's availability.

## Pattern 4: Messaging

### The problem

When a customer places an order, the order-service needs to tell the inventory-service, payment-service, shipping-service, and notification-service — but it doesn't need to wait for any of them to respond. It doesn't even need to know which services are listening. All it needs to do is announce: "an order was placed; here are the details." Whoever cares can act on it, whenever they're ready.

### The solution

**Messaging** is the integration style that the other 61 patterns in this book elaborate on. Instead of calling another application directly or sharing storage, the application puts a message on a channel (a queue or topic), and one or more receivers pick it up. The sender and receiver are decoupled in three ways:

1. **Time** — The sender doesn't wait for the receiver. The message sits in the channel until the receiver is ready. If the receiver is down, the message is stored durably and delivered when it comes back.
2. **Space** — The sender doesn't know where the receiver is. It knows the channel name, not the receiver's host, port, or URL. The messaging system handles routing.
3. **Interface** — The sender doesn't need to call a specific API. It puts a message on a channel with an agreed-upon format. The receiver can process it however it wants.

This triple decoupling is what makes messaging the foundation of loosely coupled, scalable, resilient systems. It's also what makes messaging *harder* than the other three styles — you give up synchronous request-response, immediate consistency, and simple error handling in exchange for independence, scalability, and fault tolerance.

The characteristics of messaging:

- **Asynchronous** — The sender fires and forgets. It doesn't block, doesn't wait, doesn't retry. The messaging system guarantees delivery.
- **Durable** — Messages persist until consumed. Kafka retains them for configurable periods (days, weeks, indefinitely). This means consumers can replay history.
- **Scalable** — Adding more consumers increases throughput. Kafka partitions enable parallel consumption. Pulsar subscriptions provide built-in load balancing.
- **Loosely coupled** — Services evolve independently. Adding a new consumer requires zero changes to the producer. Removing a consumer has no effect on the rest of the system.

The trade-offs:

- **Eventual consistency** — When order-service emits `OrderPlaced`, inventory-service will *eventually* process it — but "eventually" might be milliseconds or minutes. If the user refreshes the order page before inventory-service processes the event, they'll see `PLACED` instead of `RESERVED`.
- **Complexity** — Debugging is harder when the call chain is asynchronous. You can't step through a debugger across services. You need distributed tracing (OpenTelemetry), structured logging, and correlation IDs — topics we cover in Part 8.
- **Ordering** — Messages may arrive out of order, especially with multiple partitions. If `OrderPlaced` and `OrderCancelled` are processed in the wrong order, the system ends up in an inconsistent state. Kafka's partition key ordering and Camel's Resequencer pattern (Part 5) address this.
- **Exactly-once semantics** — Kafka provides at-least-once delivery by default. A consumer crash after processing but before committing the offset means the message will be redelivered. You need idempotent processing (Part 7) or Kafka transactions to achieve exactly-once.

### How Camel implements it

Here's the route that sits at the heart of our shipping domain: order-service publishes an `OrderPlaced` event to Kafka.

```java
from("direct:place-order")
    .routeId("messaging-order-placed")
    .log("Placing order for customer ${body[customer_id]}, SKU ${body[item_sku]}")
    .to("sql:INSERT INTO orders.orders (customer_id, item_sku, quantity, amount, status) "
        + "VALUES (:#customer_id, :#item_sku, :#quantity, :#amount, 'PLACED')"
        + "?dataSource=#orderDataSource")
    .to("sql:SELECT currval('orders.orders_id_seq') AS order_id"
        + "?dataSource=#orderDataSource")
    .process(exchange -> {
        Map<String, Object> row = exchange.getIn().getBody(List.class).get(0);
        exchange.getIn().setHeader("orderId", row.get("order_id"));
    })
    .setBody(simple("""
        {
          "order_id": ${header.orderId},
          "customer_id": "${body[customer_id]}",
          "item_sku": "${body[item_sku]}",
          "quantity": ${body[quantity]},
          "amount": ${body[amount]},
          "status": "PLACED"
        }
        """))
    .to("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&key=${header.orderId}"
        + "&serializerClass=org.apache.kafka.common.serialization.StringSerializer"
        + "&valueSerializer=org.apache.kafka.common.serialization.StringSerializer")
    .log("Order ${header.orderId} published to eip.orders.placed");
```

**What this route does:**

1. Receives an order on the `direct:place-order` endpoint.
2. Inserts the order into the `orders.orders` table in PostgreSQL with status `PLACED`.
3. Retrieves the auto-generated `order_id` from the sequence.
4. Constructs a JSON event body with all the order fields.
5. Publishes the event to the `eip.orders.placed` Kafka topic, using `order_id` as the message key (which determines the partition — all events for the same order go to the same partition, preserving ordering).
6. Logs confirmation.

Notice what's *not* here: there's no call to inventory-service, no call to payment-service, no knowledge of who's listening. Order-service's job is done. The downstream services each have their own Camel routes that consume from the `eip.orders.placed` topic and act independently.

Here's the consumer side — inventory-service listening for order events:

```java
from("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&groupId=inventory-service"
        + "&autoOffsetReset=earliest"
        + "&valueDeserializer=org.apache.kafka.common.serialization.StringDeserializer")
    .routeId("messaging-inventory-consumer")
    .unmarshal().json(Map.class)
    .log("Checking inventory for order ${body[order_id]}, SKU ${body[item_sku]}")
    .to("sql:SELECT quantity_on_hand FROM inventory.stock WHERE sku = :#${body[item_sku]}"
        + "?dataSource=#inventoryDataSource")
    .choice()
        .when(simple("${body[0][quantity_on_hand]} >= ${header.requestedQty}"))
            .to("sql:UPDATE inventory.stock SET quantity_on_hand = quantity_on_hand - :#${header.requestedQty} WHERE sku = :#${header.itemSku}"
                + "?dataSource=#inventoryDataSource")
            .setBody(simple("{ \"order_id\": ${header.orderId}, \"sku\": \"${header.itemSku}\", \"status\": \"RESERVED\" }"))
            .to("kafka:eip.inventory.reserved?brokers=localhost:9092")
            .log("Inventory reserved for order ${header.orderId}")
        .otherwise()
            .setBody(simple("{ \"order_id\": ${header.orderId}, \"sku\": \"${header.itemSku}\", \"status\": \"INSUFFICIENT\" }"))
            .to("kafka:eip.inventory.insufficient?brokers=localhost:9092")
            .log("Insufficient inventory for order ${header.orderId}")
    .end();
```

**What this route does:**

1. Consumes from `eip.orders.placed` as consumer group `inventory-service`. The group ID matters — it means Kafka treats all inventory-service instances as one logical consumer, load-balancing partitions across them.
2. Deserializes the JSON event into a Map.
3. Queries the `inventory.stock` table to check available quantity.
4. If sufficient, decrements stock and publishes `InventoryReserved` to `eip.inventory.reserved`.
5. If insufficient, publishes `InventoryInsufficient` to `eip.inventory.insufficient`.

Order-service and inventory-service are now fully decoupled. Inventory-service can be stopped, redeployed, or scaled to ten instances — order-service is unaffected. Events queue in Kafka until a consumer is ready. This is the power of messaging.

## Comparing the four styles

| Dimension | File Transfer | Shared Database | RPI | Messaging |
|-----------|--------------|-----------------|-----|-----------|
| **Coupling** | Loose (format only) | Tight (schema) | Medium (API contract) | Loose (message format) |
| **Timeliness** | Batch (minutes–hours) | Immediate | Synchronous | Near real-time |
| **Reliability** | High (files persist) | High (ACID) | Medium (caller blocks) | High (durable queues) |
| **Scalability** | Low | Low (shared bottleneck) | Medium | High (partition/shard) |
| **Complexity** | Low | Low | Medium | High |
| **Error model** | Retry file read | DB rollback | HTTP status + retry | DLQ + retry topic |
| **Best for** | Batch ETL, cross-org | Single-team CRUD | User-facing queries | Event-driven async |

### The hybrid reality

In practice, most systems — including our shipping domain — use more than one style:

- **Messaging** is the backbone: order-to-inventory, inventory-to-payment, payment-to-shipping, all event-driven and asynchronous.
- **RPI** handles user-facing queries: the checkout page calls shipping-service for a real-time estimate.
- **File Transfer** bridges external systems: nightly order exports to accounting, weekly inventory imports from suppliers.
- **Shared Database** appears in legacy corners: a reporting dashboard that reads across service schemas (with a read replica to avoid locking production).

The goal isn't to use only messaging — it's to choose the right style for each interaction, and to know the trade-offs well enough to make that choice deliberately.

## Common pitfalls

**"Everything should be synchronous"** — New teams often default to REST calls for every inter-service interaction because the programming model is familiar. The result is a distributed monolith: tightly coupled services that can't tolerate each other's failures. Push back: if the caller doesn't need the response to continue, use messaging.

**"Everything should be asynchronous"** — The overcorrection. Some interactions genuinely need a synchronous response (user-facing queries, payment authorization with a gateway). Forcing these through messaging adds complexity without benefit.

**"Shared database is always wrong"** — It's an anti-pattern for microservices, but it's a perfectly valid choice for a single team owning a single bounded context. The problem is when multiple teams share a schema — not when multiple routes in the same service share a database.

**"File transfer is legacy"** — CSV-over-SFTP powers a shocking amount of real-world integration. If the volume is low, the frequency is batch, and the partner is external, a file is simpler and more robust than an API.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 2: "Integration Styles"
- [enterpriseintegrationpatterns.com — Integration Styles](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IntegrationStyles.html)
- [Apache Camel — File Component](https://camel.apache.org/components/4.20.x/file-component.html)
- [Apache Camel — SQL Component](https://camel.apache.org/components/4.20.x/sql-component.html)
- [Apache Camel — HTTP Component](https://camel.apache.org/components/4.20.x/http-component.html)
- [Apache Camel — Kafka Component](https://camel.apache.org/components/4.20.x/kafka-component.html)
- [Apache Camel — Circuit Breaker EIP](https://camel.apache.org/components/4.20.x/eips/circuitBreaker-eip.html)

## What you learned

- **File Transfer** decouples through shared storage — simple but slow, best for batch and cross-organization integration.
- **Shared Database** gives instant consistency at the cost of tight schema coupling and shared bottlenecks.
- **Remote Procedure Invocation** provides synchronous request-response — essential for user-facing queries, dangerous as a default for service-to-service communication.
- **Messaging** decouples in time, space, and interface — the foundation for event-driven, loosely coupled architectures and the style that the rest of this tutorial builds on.

Next, we enter the world of messaging systems — the six building blocks (channels, messages, pipes and filters, routers, translators, and endpoints) that every messaging architecture is made of.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: all Java DSL routes compile against Camel 4.20 APIs; SQL component named parameter syntax is correct; Kafka component URI options are valid for camel-kafka 4.20; Resilience4j circuit breaker configuration properties match the Camel integration.*
