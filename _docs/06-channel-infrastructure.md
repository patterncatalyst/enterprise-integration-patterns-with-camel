---
title: "Channel Infrastructure"
order: 6
part: messaging-channels
description: "Connecting disparate systems — channel adapters, messaging bridges, and the message bus."
duration: "30 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/06-channel-infra/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/06-channel-infra) — run it with `mvn quarkus:dev` against the local stack.

The previous two chapters covered what channels are and how they handle failures. This chapter covers how channels connect to the outside world — how a REST API feeds into a Kafka topic, how messages flow between Kafka and Pulsar, and how a Message Bus provides a shared infrastructure that multiple applications can plug into without point-to-point wiring.

{% include excalidraw.html file="06-messaging-bridge" alt="Messaging Bridge connecting Kafka to Pulsar" caption="Figure 6.1 — A Camel Messaging Bridge forwards events from Kafka to Pulsar for cross-system integration." %}

These are the patterns that make messaging practical in heterogeneous environments — and they're where Camel's component library shines, because connecting disparate systems is exactly what Camel was built for.

## Pattern: Channel Adapter

### The problem

The shipping domain's order-service exposes a REST API. Customers create orders via HTTP POST. But the internal event flow is Kafka-based — inventory-service, payment-service, and the rest consume from Kafka topics, not REST endpoints. Something needs to bridge the gap between the synchronous HTTP world and the asynchronous messaging world.

Similarly, the accounting system produces a nightly CSV file that needs to become a stream of Kafka messages for downstream processing. And the legacy CRM system has a SOAP API that needs to emit events when customer records change.

Each of these is the same problem: an application that doesn't speak messaging needs to participate in a messaging architecture.

### The solution

A **Channel Adapter** is a component that connects a non-messaging application to a messaging channel. It translates between the application's native protocol (HTTP, file, database, SOAP, FTP) and the messaging system. The application doesn't know it's part of a messaging architecture — the adapter handles the translation.

Channel adapters come in two directions:

- **Inbound adapter** — Receives from the external system and produces to a message channel. Example: an HTTP endpoint that accepts order requests and publishes `OrderPlaced` events to Kafka.
- **Outbound adapter** — Consumes from a message channel and sends to the external system. Example: a route that consumes `ShipmentScheduled` events and calls a carrier's REST API.

### How Camel models it

Every Camel component is, in essence, a channel adapter factory. The `platform-http` component adapts HTTP to messaging; the `file` component adapts the filesystem to messaging; the `sql` component adapts a database to messaging. When you write a Camel route, you're wiring channel adapters together.

Here's the inbound adapter that bridges HTTP to Kafka — the front door of the shipping domain:

```java
// Inbound adapter: HTTP → Kafka
rest("/api/orders")
    .post()
    .consumes("application/json")
    .produces("application/json")
    .to("direct:create-order");

from("direct:create-order")
    .routeId("channel-adapter-inbound")
    .log("Received order from HTTP: ${body}")
    .to("sql:INSERT INTO orders.orders (customer_id, item_sku, quantity, amount, status) "
        + "VALUES (:#customer_id, :#item_sku, :#quantity, :#amount, 'PLACED')"
        + "?dataSource=#orderDataSource")
    .to("sql:SELECT currval('orders.orders_id_seq') AS order_id"
        + "?dataSource=#orderDataSource")
    .setHeader("orderId", simple("${body[0][order_id]}"))
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092&key=${header.orderId}")
    .setBody(simple("{\"order_id\": ${header.orderId}, \"status\": \"PLACED\"}"))
    .log("Order ${header.orderId} published to Kafka");

// Outbound adapter: Kafka → HTTP (carrier API)
from("kafka:eip.shipping.scheduled?brokers=localhost:9092&groupId=carrier-adapter")
    .routeId("channel-adapter-outbound")
    .unmarshal().json(Map.class)
    .log("Notifying carrier for shipment ${body[shipment_id]}")
    .setHeader(Exchange.HTTP_METHOD, constant("POST"))
    .setHeader(Exchange.CONTENT_TYPE, constant("application/json"))
    .marshal().json()
    .to("http://carrier-api.example.com/shipments?connectTimeout=5000")
    .log("Carrier notified for shipment ${body[shipment_id]}");
```

The REST endpoint (`platform-http`) is the inbound channel adapter — it translates HTTP requests into Camel exchanges that flow into the Kafka-based messaging system. The HTTP client (`http:`) on the outbound side is the outbound channel adapter — it translates Kafka messages into HTTP requests to an external API.

### Other common channel adapters in Camel

| Adapter | Component | Direction | Use Case |
|---------|-----------|-----------|----------|
| File polling | `file:` / `sftp:` | Inbound | Watch a directory for new files |
| Database polling | `sql:` / `jpa:` | Inbound | Poll a table for new/changed rows |
| Email | `imap:` / `smtp:` | Both | Receive or send email triggers |
| AWS S3 | `aws2-s3:` | Both | Object storage integration |
| Slack | `slack:` | Outbound | Notifications to a Slack channel |
| Timer/Scheduler | `timer:` / `quartz:` | Inbound | Time-based event generation |

Camel's 400+ components are all channel adapters. That's the entire point of the framework.

## Pattern: Messaging Bridge

### The problem

Your shipping domain runs on Kafka, but a partner organization's order management system runs on Apache Pulsar. Their `partner.orders.placed` Pulsar topic needs to flow into your `eip.orders.placed` Kafka topic — seamlessly, reliably, and without the partner needing to know about your infrastructure.

Or internally: some pattern examples in this tutorial use Pulsar for specific features (shared subscriptions, per-message TTL). Messages need to flow between Kafka and Pulsar topics without manual intervention.

### The solution

A **Messaging Bridge** connects two messaging systems so that messages flow between them transparently. It's a channel adapter between two messaging systems rather than between a messaging system and a non-messaging application.

A bridge handles:
- **Protocol translation** — Kafka's producer/consumer protocol to Pulsar's client protocol.
- **Header mapping** — Kafka headers to Pulsar properties and vice versa.
- **Serialization** — Converting between the two systems' native serialization if they differ.
- **Reliability** — Ensuring no messages are lost in transit (typically by committing the source offset only after the destination acknowledges).

### How Camel models it

A Camel messaging bridge is just a route with a messaging `from()` and a messaging `to()`:

```java
// Bridge: Pulsar → Kafka
from("pulsar:persistent://public/default/partner.orders.placed"
        + "?subscriptionName=kafka-bridge"
        + "&subscriptionType=Exclusive")
    .routeId("messaging-bridge-pulsar-to-kafka")
    .log("Bridging partner order from Pulsar to Kafka")
    // Map Pulsar properties to Kafka headers
    .setHeader("bridgeSource", constant("pulsar"))
    .setHeader("bridgeTimestamp", simple("${date:now:yyyy-MM-dd'T'HH:mm:ss}"))
    .to("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&requestRequiredAcks=all");

// Bridge: Kafka → Pulsar
from("kafka:eip.shipping.scheduled"
        + "?brokers=localhost:9092"
        + "&groupId=pulsar-bridge")
    .routeId("messaging-bridge-kafka-to-pulsar")
    .log("Bridging shipment event from Kafka to Pulsar")
    .to("pulsar:persistent://public/default/eip.shipping.scheduled"
        + "?producerName=kafka-bridge");
```

The bridge route looks deceptively simple. The complexity is in the reliability: the Pulsar consumer must not acknowledge a message until the Kafka producer confirms receipt (and vice versa). Camel handles this when you use synchronous producers (`requestRequiredAcks=all` for Kafka, the default synchronous send for Pulsar) — the `to()` call blocks until the destination confirms, and only then does the `from()` consumer acknowledge.

## Pattern: Message Bus

### The problem

As the shipping domain grows, new services appear: a fraud detection service, a loyalty points service, a returns management service. Each one needs to connect to the event stream, and each one needs to understand the event formats, the topic naming conventions, the serialization protocol, and the schema registry. If every service implements its own Kafka client configuration and Avro deserialization, you end up with duplicated boilerplate, inconsistent conventions, and configuration drift.

### The solution

A **Message Bus** is a shared messaging infrastructure that provides a common, standardized way for applications to connect. It's more than a broker — it's a broker plus conventions, shared configuration, and a consistent programming model that make integration plug-and-play.

In our shipping domain, the message bus is the combination of:

1. **Kafka** — the broker (and Pulsar for specific use cases).
2. **Apicurio Registry** — schema governance, ensuring all services agree on event formats.
3. **Topic naming convention** — `eip.<domain>.<event>`, followed by every service.
4. **Serialization standard** — Avro with Apicurio-backed serializers/deserializers.
5. **Camel Quarkus** — the programming model, providing a consistent way to define routes.
6. **Shared configuration** — Connection strings, serializer classes, consumer group naming conventions, all defined once in a parent POM or shared configuration.

### How Camel models it

The message bus concept manifests as shared Camel configuration. Instead of repeating Kafka broker addresses, serializer classes, and registry URLs in every route, you define them once in `application.properties` and reference them through Camel's property resolution:

```java
// With shared configuration in application.properties:
//   camel.component.kafka.brokers=localhost:9092
//   camel.component.kafka.value-deserializer=org.apache.kafka.common.serialization.StringDeserializer
//   camel.component.kafka.auto-offset-reset=earliest

// Routes become simple — the bus configuration is shared
from("kafka:eip.orders.placed?groupId=fraud-detection")
    .routeId("message-bus-fraud")
    .unmarshal().json(Map.class)
    .log("Fraud check for order ${body[order_id]}")
    .to("direct:fraud-check");

from("kafka:eip.orders.placed?groupId=loyalty-service")
    .routeId("message-bus-loyalty")
    .unmarshal().json(Map.class)
    .log("Loyalty points for order ${body[order_id]}")
    .to("direct:award-points");

from("kafka:eip.payments.processed?groupId=fraud-detection")
    .routeId("message-bus-fraud-payments")
    .unmarshal().json(Map.class)
    .log("Payment fraud check for order ${body[order_id]}")
    .to("direct:payment-fraud-check");
```

When Kafka component-level properties are set in `application.properties`, every route that uses `kafka:` inherits them automatically. A new service joining the bus just needs to know the topic name and its consumer group — everything else is standardized.

## Common pitfalls

**Building adapters without error handling.** An inbound channel adapter that crashes on a malformed HTTP request and loses the message is worse than no adapter at all. Combine channel adapters with the Invalid Message Channel and Dead Letter Channel patterns from the previous chapter.

**Bridging without considering ordering.** A bridge between two messaging systems may not preserve message ordering. If Kafka has 3 partitions and Pulsar has a single partition, messages that were ordered per-partition in Kafka may interleave in Pulsar. If ordering matters, key your messages and ensure the bridge preserves key-based routing.

**Treating the message bus as just a broker.** A broker is infrastructure; a bus is infrastructure plus conventions. If every service has its own topic naming scheme, serialization format, and error handling strategy, you have a broker, not a bus. The value of a message bus is the standardization.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 4: "Messaging Channels"
- [enterpriseintegrationpatterns.com — Channel Adapter](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ChannelAdapter.html)
- [enterpriseintegrationpatterns.com — Messaging Bridge](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessagingBridge.html)
- [enterpriseintegrationpatterns.com — Message Bus](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageBus.html)
- [Apache Camel — REST DSL](https://camel.apache.org/manual/rest-dsl.html)
- [Apache Camel — Component Configuration](https://camel.apache.org/manual/component.html)

## What you learned

- **Channel Adapter** bridges non-messaging systems into the messaging architecture — Camel's 400+ components are all channel adapter factories.
- **Messaging Bridge** connects two messaging systems transparently — a Camel route from one broker to another, with reliability managed by synchronous sends.
- **Message Bus** is the shared infrastructure plus conventions (naming, serialization, schema governance, configuration) that make integration plug-and-play.
- Camel's component-level configuration in `application.properties` standardizes the bus so routes only need to name their channel and consumer group.

This completes Part 3 — Messaging Channels. Next, we move inside the message itself: Part 4 covers Message Construction — command, document, and event messages, request-reply, correlation, sequencing, and expiration.

---

*Verification status: verified against Quarkus 3.36.3, Camel 4.20.0 on Podman (2026-07-11).*
