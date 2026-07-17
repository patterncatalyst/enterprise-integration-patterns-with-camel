---
title: "Message Metadata"
order: 8
part: message-construction
description: "Request-reply, correlation identifiers, return addresses, message sequences, expiration, and format indicators — the metadata that makes asynchronous conversations possible."
duration: "45 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/08-message-metadata/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/08-message-metadata) with subdirectories for each runtime.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/08-message-metadata/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/08-message-metadata/spring-boot
mvn spring-boot:run
```

A message carries more than data. It carries context: *Who should reply? Where should the reply go? Which conversation does this belong to? Is this part 3 of 5? Has it expired?* These metadata patterns turn one-way message sends into structured, multi-step conversations — without coupling sender and receiver.

{% include excalidraw.html file="08-request-reply" alt="Request-Reply pattern with Correlation Identifier" caption="Figure 8.1 — Request-Reply using separate channels and a Correlation Identifier to match replies." %}

This chapter covers six patterns that address these questions. Together with the three message types from the previous chapter, they complete Message Construction — everything that goes *into* a message before it hits the wire.

## Pattern: Request-Reply

### The problem

When order-service publishes an `OrderPlaced` event, it doesn't expect a response. That's the beauty of events. But during checkout, order-service needs to call inventory-service synchronously to check if items are in stock *before* accepting the order. The response matters — the order shouldn't proceed without confirmation.

HTTP makes this trivial: send a request, get a response. But what if inventory-service is a Kafka-based microservice? You want to leverage the same messaging infrastructure for request-reply without switching to HTTP.

### The solution

The **Request-Reply** pattern implements synchronous-style conversations over asynchronous messaging:

1. The requestor sends a message to a **request channel**.
2. The message includes a **return address** (the reply channel) and a **correlation identifier**.
3. The replier processes the request and sends the response to the return address, copying the correlation identifier.
4. The requestor listens on the reply channel, matching incoming responses to outstanding requests by correlation ID.

Camel automates most of this through its `InOut` exchange pattern. When you use `request/reply` semantics (like `to()` with an `InOut` exchange), Camel manages the reply channel, correlation, and timeout for you.

### How Camel models it

**Using Kafka request-reply with `ReplyTo` headers:**

```java
// Requestor: send to the request channel, wait for reply
from("direct:check-stock")
    .routeId("request-reply-requestor")
    .setHeader("orderId", simple("${body[order_id]}"))
    .setHeader("CamelKafkaReplyTopic", constant("eip.inventory.replies"))
    .marshal().json()
    .to(ExchangePattern.InOut, "kafka:eip.inventory.requests"
        + "?brokers=localhost:9092"
        + "&replyTopic=eip.inventory.replies"
        + "&requestTimeout=30000")
    .unmarshal().json(Map.class)
    .log("Stock check result for order ${header.orderId}: ${body[available]}");

// Replier: process the request, Camel sends the reply automatically
from("kafka:eip.inventory.requests?brokers=localhost:9092&groupId=inventory-service")
    .routeId("request-reply-replier")
    .unmarshal().json(Map.class)
    .log("Checking inventory for SKU ${body[item_sku]}")
    .process(exchange -> {
        Map<String, Object> request = exchange.getIn().getBody(Map.class);
        String sku = (String) request.get("item_sku");
        int quantity = ((Number) request.get("quantity")).intValue();
        // Simulate inventory check
        boolean available = quantity <= 100;
        Map<String, Object> reply = new java.util.LinkedHashMap<>();
        reply.put("item_sku", sku);
        reply.put("requested", quantity);
        reply.put("available", available);
        reply.put("warehouse", "EAST-1");
        exchange.getIn().setBody(reply);
    })
    .marshal().json();
```

### JBang quick-test

You can prototype request-reply with `camel run`. Save the replier route as `inventory-replier.yaml`:

```bash
camel run inventory-replier.yaml --dev
```

In a second terminal, run the requestor route. Use `camel get` to see both routes and their exchange patterns:

```bash
camel get route
```

This shows `InOut` vs `InOnly` for each route — a quick way to verify that request-reply is wired correctly before promoting to a Quarkus project.

### When to avoid request-reply over messaging

Request-reply over Kafka is powerful but adds complexity compared to a simple HTTP call. Use it when:
- You want both sides on the same messaging infrastructure (no separate HTTP endpoint to deploy/monitor).
- You need Kafka's durability guarantees (the request survives a consumer restart).
- You're already in a Kafka-centric architecture and want consistency.

Avoid it when a simple REST call would suffice — the overhead of a reply topic, correlation, and timeout management isn't worth it for a straightforward synchronous call to a service that already has an HTTP API.

## Pattern: Return Address

### What it is

The **Return Address** pattern specifies where the reply should go. Instead of hardcoding the reply destination, the requestor includes the return address *in the message*, so the replier sends the response to wherever the requestor specifies.

This decouples the replier from the requestor's infrastructure. The replier doesn't need to know *who* asked — it just replies to the address it was given. Different requestors can specify different reply channels.

### How it works in practice

In Kafka, the return address is the **reply topic** — a header (or property) on the request message that tells the replier where to send the response. Camel's Kafka component supports this with `CamelKafkaReplyTopic`:

```java
// Requestor specifies the return address
from("direct:stock-check-with-return-address")
    .routeId("return-address")
    .setHeader("CamelKafkaReplyTopic", constant("eip.order-service.replies"))
    .setHeader("requestSource", constant("order-service"))
    .marshal().json()
    .to(ExchangePattern.InOut, "kafka:eip.inventory.requests"
        + "?brokers=localhost:9092"
        + "&replyTopic=eip.order-service.replies"
        + "&requestTimeout=30000");

// A different requestor can specify a different return address
from("direct:stock-check-from-analytics")
    .routeId("return-address-analytics")
    .setHeader("CamelKafkaReplyTopic", constant("eip.analytics-service.replies"))
    .setHeader("requestSource", constant("analytics-service"))
    .marshal().json()
    .to(ExchangePattern.InOut, "kafka:eip.inventory.requests"
        + "?brokers=localhost:9092"
        + "&replyTopic=eip.analytics-service.replies"
        + "&requestTimeout=30000");
```

The replier routes are identical in both cases — it just replies to whatever `CamelKafkaReplyTopic` header it finds. The return address makes the replier completely agnostic to who's asking.

## Pattern: Correlation Identifier

### The problem

When order-service sends a stock check request and inventory-service sends back the result, how does order-service know which request the result corresponds to? If order-service sends 50 stock checks per second, the reply "available: true, warehouse: EAST-1" is meaningless without knowing which order it's for.

### The solution

A **Correlation Identifier** is a unique ID placed on the request message and copied onto the reply. The requestor generates a correlation ID, attaches it to the request, and when the reply arrives, matches it to the outstanding request by the same ID.

Camel handles correlation automatically in `InOut` exchanges — the framework generates a correlation ID, attaches it to the request, and matches the reply. But you can also do it explicitly when you need custom correlation logic:

### How Camel models it

```java
// Explicit correlation: set a correlation ID on the request
from("direct:correlated-request")
    .routeId("correlation-id-sender")
    .process(exchange -> {
        String correlationId = java.util.UUID.randomUUID().toString();
        exchange.getIn().setHeader("correlationId", correlationId);
        exchange.setProperty("originalCorrelationId", correlationId);
    })
    .marshal().json()
    .to("kafka:eip.inventory.requests?brokers=localhost:9092");

// Replier copies the correlation ID to the reply
from("kafka:eip.inventory.requests?brokers=localhost:9092&groupId=inventory-service")
    .routeId("correlation-id-replier")
    .unmarshal().json(Map.class)
    .log("Processing request ${header.correlationId}")
    .process(exchange -> {
        Map<String, Object> reply = new java.util.LinkedHashMap<>();
        reply.put("available", true);
        reply.put("warehouse", "EAST-1");
        exchange.getIn().setBody(reply);
        // correlationId header is already set — it carries through
    })
    .marshal().json()
    .to("kafka:eip.inventory.replies?brokers=localhost:9092");

// Requestor matches reply by correlation ID
from("kafka:eip.inventory.replies?brokers=localhost:9092&groupId=order-service")
    .routeId("correlation-id-receiver")
    .unmarshal().json(Map.class)
    .log("Reply for correlation ${header.correlationId}: ${body[available]}")
    .to("direct:process-inventory-reply");
```

### Correlation in our event-driven domain

Even without explicit request-reply, correlation is everywhere in the shipping domain. The `order_id` field is a natural correlation identifier — it ties together `OrderPlaced`, `InventoryReserved`, `PaymentProcessed`, and `ShipmentScheduled` events across services. When debugging a problem with order 42, you `grep` for `order_id=42` across all topics and reconstruct the full conversation.

For distributed tracing, Camel propagates OpenTelemetry trace IDs as headers. The trace ID is a correlation identifier that spans the entire request lifecycle — from the initial HTTP request through every Kafka message to the final notification. More on this in Part 8 (System Management).

## Pattern: Message Sequence

### The problem

A large customer places a bulk order with 500 line items. Sending all 500 items in a single Kafka message could exceed the maximum message size (default 1 MB). Even if it fits, a single large message blocks the consumer while it processes all 500 items — other orders wait.

You need to split the order into multiple messages. But the receiver needs to know: *Is this part of a larger set? Which part? Am I done?*

### The solution

A **Message Sequence** splits a large message into numbered parts, with metadata on each part indicating:
- The **sequence number** (which part this is).
- The **total count** or an **end-of-sequence** flag (so the receiver knows when it has all parts).
- A **sequence identifier** that groups the parts (so the receiver can distinguish between parts of order 42 and parts of order 43).

Camel's **Splitter** EIP produces message sequences automatically: each split message gets `CamelSplitIndex`, `CamelSplitSize`, and `CamelSplitComplete` headers. On the receiving side, Camel's **Aggregator** EIP reassembles the parts — which we'll cover in Part 6 (Message Transformation).

### How Camel models it

```java
// Split a bulk order into individual line items
from("direct:bulk-order")
    .routeId("message-sequence-splitter")
    .process(exchange -> {
        String sequenceId = java.util.UUID.randomUUID().toString();
        exchange.getIn().setHeader("sequenceId", sequenceId);
    })
    .split(jsonpath("$.line_items"))
        .setHeader("sequenceNumber", simple("${header.CamelSplitIndex}"))
        .setHeader("sequenceSize", simple("${header.CamelSplitSize}"))
        .setHeader("sequenceLast", simple("${header.CamelSplitComplete}"))
        .marshal().json()
        .to("kafka:eip.orders.line-items?brokers=localhost:9092"
            + "&key=${header.sequenceId}")
        .log("Sent item ${header.sequenceNumber} of ${header.sequenceSize} "
            + "(last: ${header.sequenceLast})")
    .end();

// Receiver: aggregate until we have all parts
from("kafka:eip.orders.line-items?brokers=localhost:9092&groupId=fulfillment-service")
    .routeId("message-sequence-aggregator")
    .unmarshal().json(Map.class)
    .aggregate(header("sequenceId"), AggregationStrategies.groupedBody())
        .completionSize(header("sequenceSize"))
        .completionTimeout(60000)
        .log("Received all ${header.sequenceSize} items for sequence ${header.sequenceId}")
        .to("direct:process-complete-order");
```

### Kafka ordering and sequences

When splitting a message sequence across Kafka, use the **same key** for all parts (`key=${header.sequenceId}`). Kafka guarantees ordering within a partition, and messages with the same key go to the same partition. This means parts arrive in order at the consumer — which simplifies reassembly.

If parts arrive out of order (because they were keyed differently or the topic was repartitioned), the aggregator still works — it just waits for all parts regardless of arrival order. The `completionTimeout` is a safety net: if a part is lost, the aggregator times out rather than waiting forever.

## Pattern: Message Expiration

### The problem

A shipping estimate request is useless if it arrives 30 minutes late — the customer has already left the checkout page. A flash sale notification that arrives after the sale ends is worse than useless — it sends customers to a page that shows full prices.

Some messages have a shelf life. If they can't be processed within that window, they should be discarded rather than processed stale.

### The solution

A **Message Expiration** (also called Time-to-Live or TTL) attaches a timestamp or duration to a message. If the message isn't consumed before it expires, it's discarded or routed to a dead letter channel. The receiver checks the expiration before processing and drops expired messages.

### How Camel models it

Kafka doesn't natively support per-message TTL (it has topic-level retention, which is different). But you can implement expiration at the application level with Camel headers:

```java
// Producer: set expiration on the message
from("direct:flash-sale-notification")
    .routeId("message-expiration-producer")
    .process(exchange -> {
        long now = System.currentTimeMillis();
        long ttlMs = 300_000; // 5 minutes
        exchange.getIn().setHeader("messageCreatedAt", now);
        exchange.getIn().setHeader("messageExpiresAt", now + ttlMs);
    })
    .marshal().json()
    .to("kafka:eip.notifications.flash-sale?brokers=localhost:9092");

// Consumer: check expiration before processing
from("kafka:eip.notifications.flash-sale?brokers=localhost:9092&groupId=notification-service")
    .routeId("message-expiration-consumer")
    .unmarshal().json(Map.class)
    .choice()
        .when().groovy("request.headers['messageExpiresAt'] < System.currentTimeMillis()")
            .log("EXPIRED: discarding flash sale notification "
                + "(created ${header.messageCreatedAt}, expired ${header.messageExpiresAt})")
            .to("kafka:eip.notifications.expired?brokers=localhost:9092")
        .otherwise()
            .log("Processing flash sale notification")
            .to("direct:send-notification")
    .end();
```

### Pulsar's native TTL

Unlike Kafka, Apache Pulsar supports **per-message TTL** natively. If a message isn't acknowledged within the TTL, Pulsar moves it to the dead letter topic automatically. This makes Pulsar a natural fit for expiration-sensitive workloads:

```java
// Pulsar with native TTL (configured at the namespace level)
// pulsar-admin namespaces set-message-ttl public/default --messageTTL 300

from("pulsar:persistent://public/default/flash-sale"
        + "?subscriptionName=notification-service"
        + "&subscriptionType=Shared")
    .routeId("pulsar-ttl")
    .log("Processing flash sale notification (Pulsar enforces TTL)")
    .to("direct:send-notification");
```

This is one of the cases where Pulsar's feature set makes a pattern simpler — you don't need application-level expiration checks because the broker handles it.

## Pattern: Format Indicator

### The problem

The accounting system sends CSV files. The partner API sends XML. Internal services send JSON. A legacy system sends fixed-width text. When a message arrives, the consumer needs to know the format *before* trying to parse it — unmarshaling JSON as XML doesn't end well.

### The solution

A **Format Indicator** tells the receiver what format the message body is in. This can be:
- A **header** (like `Content-Type: application/json`).
- A **well-known file extension** (`.csv`, `.xml`, `.json`).
- A **schema identifier** (an Avro schema ID from the registry).
- A **magic byte** (Avro messages from Confluent-style registries start with `0x00` followed by a 4-byte schema ID).

In HTTP-based systems, `Content-Type` is the format indicator. In messaging systems, it's typically a header or a schema registry reference.

### How Camel models it

Camel's data format mechanism is the natural home for format indicators. When you `marshal()` and `unmarshal()`, you're declaring the format. Headers make it dynamic:

```java
// Producer: include format indicator as a header
from("direct:multi-format-producer")
    .routeId("format-indicator-producer")
    .choice()
        .when(header("targetFormat").isEqualTo("json"))
            .marshal().json()
            .setHeader("contentType", constant("application/json"))
        .when(header("targetFormat").isEqualTo("xml"))
            .marshal().jacksonXml()
            .setHeader("contentType", constant("application/xml"))
        .when(header("targetFormat").isEqualTo("csv"))
            .marshal().csv()
            .setHeader("contentType", constant("text/csv"))
    .end()
    .to("kafka:eip.accounting.exports?brokers=localhost:9092");

// Consumer: use format indicator to choose unmarshaling
from("kafka:eip.accounting.exports?brokers=localhost:9092&groupId=accounting-import")
    .routeId("format-indicator-consumer")
    .choice()
        .when(header("contentType").isEqualTo("application/json"))
            .unmarshal().json(Map.class)
            .log("Imported JSON record")
        .when(header("contentType").isEqualTo("application/xml"))
            .unmarshal().jacksonXml(Map.class)
            .log("Imported XML record")
        .when(header("contentType").isEqualTo("text/csv"))
            .unmarshal().csv()
            .log("Imported CSV record")
        .otherwise()
            .log("Unknown format: ${header.contentType}")
            .to("kafka:eip.accounting.errors?brokers=localhost:9092")
    .end()
    .to("direct:process-accounting-record");
```

### Schema registry as a format indicator

In Avro-based systems with Apicurio Registry, the format indicator is built into the serialized bytes. The first byte is a magic byte (`0x00`), followed by a global schema ID. The deserializer reads the ID, fetches the schema from the registry, and deserializes accordingly. No explicit headers needed — the format indicator is embedded in the payload.

This is one reason the shipping domain uses Avro + Apicurio: the format indicator is automatic, machine-verifiable, and supports schema evolution.

## How these patterns compose

The six metadata patterns rarely appear in isolation. Here's how they compose in the shipping domain's checkout flow:

```
1. Customer submits order → HTTP POST (Channel Adapter)
2. Order-service creates an order and needs a stock check
   → Request-Reply to inventory-service:
     - Return Address: eip.order-service.replies
     - Correlation Identifier: UUID
     - Message Expiration: 30 seconds
     - Format Indicator: application/json
3. Inventory-service checks stock, replies to the return address
   with the same correlation ID
4. If the order has 500 line items, inventory-service splits
   the response → Message Sequence with sequenceId, index, size
5. Order-service aggregates the sequence parts and proceeds
```

Each pattern solves one specific problem. Together, they make asynchronous conversations tractable.

## Common pitfalls

**Correlation without cleanup.** If you maintain a map of outstanding correlation IDs (for manual request-reply), and a reply never arrives, the map leaks. Use a timeout to expire stale entries — Camel's `requestTimeout` handles this automatically in `InOut` exchanges.

**TTL without clock sync.** If the producer's clock says it's 10:00:00 and the consumer's clock says it's 10:05:30, a 5-minute TTL has already expired by the time it arrives. Use NTP to keep clocks synchronized, or use durations (created + TTL milliseconds) rather than absolute timestamps. In a Kubernetes environment, all pods typically share the same NTP source, so this is less of an issue than with physical servers.

**Sequences without idempotency.** If the consumer crashes halfway through processing a sequence and restarts, it may process some parts twice. Use idempotent consumption (covered in Part 7) to handle duplicate deliveries.

**Format assumptions.** Don't assume format from the topic name. `eip.accounting.exports` could carry JSON today and CSV tomorrow. Use explicit format indicators — headers or schema registry — so consumers adapt automatically.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 5: "Message Construction"
- [enterpriseintegrationpatterns.com — Request-Reply](https://www.enterpriseintegrationpatterns.com/patterns/messaging/RequestReply.html)
- [enterpriseintegrationpatterns.com — Return Address](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ReturnAddress.html)
- [enterpriseintegrationpatterns.com — Correlation Identifier](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CorrelationIdentifier.html)
- [enterpriseintegrationpatterns.com — Message Sequence](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageSequence.html)
- [enterpriseintegrationpatterns.com — Message Expiration](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageExpiration.html)
- [enterpriseintegrationpatterns.com — Format Indicator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/FormatIndicator.html)
- [Apache Camel — Splitter EIP](https://camel.apache.org/components/4.20.x/eips/split-eip.html)
- [Apache Camel — Aggregator EIP](https://camel.apache.org/components/4.20.x/eips/aggregate-eip.html)

## What you learned

- **Request-Reply** implements synchronous conversations over asynchronous messaging — Camel's `InOut` exchange pattern manages the wiring.
- **Return Address** decouples the replier from the requestor — the reply destination travels with the message.
- **Correlation Identifier** matches replies to requests — Camel auto-generates these for `InOut`, or you can use domain identifiers like `order_id`.
- **Message Sequence** splits large messages into numbered parts — Camel's Splitter produces sequence metadata automatically.
- **Message Expiration** discards stale messages — implement at the application level with headers (Kafka) or use Pulsar's native TTL.
- **Format Indicator** tells the receiver how to parse the body — use headers, schema registry, or Avro's embedded schema ID.

This completes Part 4 — Message Construction. Next: Part 5 — Message Routing, where we explore the patterns that determine *where* a message goes: content-based router, message filter, splitter, aggregator, and the full routing catalog.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
