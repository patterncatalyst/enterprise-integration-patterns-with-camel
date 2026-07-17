---
title: "Channel Types"
order: 4
part: messaging-channels
description: "Point-to-point, publish-subscribe, and datatype channels — the three fundamental channel patterns that determine how messages are delivered."
duration: "35 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/04-channel-types/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/04-channel-types) with subdirectories for each runtime.

{% include codetabs.html langs="Quarkus|Spring Boot|YAML DSL" %}

```bash
# Quarkus
cd examples/04-channel-types/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/04-channel-types/spring-boot
mvn spring-boot:run
```

```bash
# YAML DSL (Camel CLI)
cd examples/04-channel-types/yaml-dsl
camel run *
```

The previous chapter introduced the Message Channel as one of six building blocks. But not all channels behave the same way. The most important design decision in any messaging architecture is the channel type: does a message go to *one* consumer or to *all* consumers? This chapter covers the three channel patterns that answer that question, shows how Kafka and Pulsar implement each one, and demonstrates how Camel routes connect to them.

{% include excalidraw.html file="04-channel-types" alt="Point-to-Point vs Publish-Subscribe channel types" caption="Figure 4.1 — Point-to-Point delivers to one consumer; Publish-Subscribe delivers to all consumer groups." %}

## Pattern: Point-to-Point Channel

### The problem

When an `OrderPlaced` event arrives, the inventory-service needs to check stock and reserve it. If you're running three instances of inventory-service for throughput, each order must be processed by exactly one instance. If all three process the same order, you'll triple-decrement the stock and corrupt your inventory.

You need a channel where messages are distributed *across* consumers, not duplicated *to* consumers.

### The solution

A **Point-to-Point Channel** ensures that each message is consumed by exactly one receiver. If multiple consumers are connected to the channel, they compete — the messaging system delivers each message to one and only one of them. This is sometimes called a **competing consumers** pattern (covered in more detail in Part 7).

The key guarantee: at-most-one *consumer* will process each message (assuming no redelivery). This is fundamental for any operation that isn't idempotent — like decrementing inventory.

### How Kafka implements it

In Kafka, point-to-point semantics come from the **consumer group**. All consumers with the same `group.id` form a group, and Kafka assigns each partition to exactly one consumer in the group. A message on a given partition is delivered to only one consumer:

{% include excalidraw.html file="04-point-to-point" alt="Kafka topic with 3 partitions, each assigned to exactly one consumer in the inventory-service consumer group" caption="Figure 4.1 — Point-to-point via Kafka consumer groups: each partition is assigned to exactly one consumer instance." %}

If Instance B crashes, Kafka reassigns Partition 1 to Instance A or C (a **rebalance**). No messages are lost; processing continues with the surviving instances.

### How Pulsar implements it

In Pulsar, point-to-point semantics come from **subscription types**:

- **Exclusive subscription** — Only one consumer is allowed. A second consumer attempting to subscribe is rejected. Simple but no scaling.
- **Failover subscription** — One active consumer; others are standby. If the active consumer disconnects, a standby takes over.
- **Shared subscription** — Messages are round-robin distributed across all consumers in the subscription. This is the closest analog to Kafka's consumer group.
- **Key-shared subscription** — Like shared, but messages with the same key always go to the same consumer. Preserves per-key ordering while scaling horizontally.

### How Camel models it

The route logic is identical across runtimes — only the class annotations differ:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
// Quarkus — CDI discovers the route via @ApplicationScoped
@ApplicationScoped
public class PointToPointRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=inventory-service")
            .routeId("point-to-point-consumer")
            // route logic below...
    }
}
```

```java
// Spring Boot — Spring discovers the route via @Component
@Component
public class PointToPointRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=inventory-service")
            .routeId("point-to-point-consumer")
            // route logic below...
    }
}
```

The Camel DSL inside `configure()` is pure Camel — identical on both runtimes:

```java
// Kafka point-to-point: consumer group ensures single delivery
from("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&groupId=inventory-service"
        + "&autoOffsetReset=earliest"
        + "&maxPollRecords=10")
    .routeId("point-to-point-kafka")
    .unmarshal().json(Map.class)
    .log("Instance processing order ${body[order_id]}")
    .to("direct:check-inventory");

// Pulsar point-to-point: shared subscription
from("pulsar:persistent://public/default/eip.orders.placed"
        + "?subscriptionName=inventory-service"
        + "&subscriptionType=Shared")
    .routeId("point-to-point-pulsar")
    .log("Instance processing order from Pulsar")
    .to("direct:check-inventory");
```

The critical parameter is `groupId` (Kafka) or `subscriptionName` + `subscriptionType=Shared` (Pulsar). Without a consumer group in Kafka, each consumer instance gets *all* messages — which is publish-subscribe, the next pattern.

## Pattern: Publish-Subscribe Channel

### The problem

When an order is placed, *both* inventory-service and notification-service need to know about it. Inventory-service needs to check stock; notification-service needs to send a confirmation email. These are independent concerns — one shouldn't block the other, and adding a third subscriber (say, an analytics service) shouldn't require changing the publisher or any existing subscriber.

You need a channel where every subscriber gets every message.

### The solution

A **Publish-Subscribe Channel** delivers a copy of each message to every subscriber. The publisher sends once; the messaging system handles the fan-out. Subscribers are independent — they can be added or removed without affecting the publisher or each other.

This is the foundation of event-driven architecture: producers announce facts (events), and any number of consumers react to them independently.

### How Kafka implements it

In Kafka, publish-subscribe emerges naturally from **multiple consumer groups** on the same topic:

{% include excalidraw.html file="04-pub-sub" alt="Kafka topic fanning out to three independent consumer groups — inventory, notification, and analytics — each receiving all messages" caption="Figure 4.2 — Publish-subscribe via multiple consumer groups: each group receives every message independently. Adding analytics-service requires no changes to the publisher or existing consumers." %}

This is elegant: the same topic supports both point-to-point (within a group) and publish-subscribe (across groups) simultaneously. The publisher doesn't know or care how many groups are listening.

### How Pulsar implements it

In Pulsar, each **subscription** to a topic is an independent subscriber. Multiple subscriptions on the same topic give you publish-subscribe:

{% include excalidraw.html file="04-pulsar-subscriptions" alt="Pulsar topic with three subscriptions — inventory (Shared with two consumers), notification (Exclusive), and analytics (Exclusive)" caption="Figure 4.3 — Pulsar subscriptions: each subscription receives every message independently. The Shared subscription distributes work across multiple consumers; Exclusive subscriptions have one active consumer each." %}

### How Camel models it

The publisher route is the same regardless of how many consumers exist — that's the whole point of publish-subscribe:

```java
// Publisher — sends to the topic once
from("direct:publish-order")
    .routeId("pubsub-publisher")
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");

// Subscriber 1 — inventory (different consumer group)
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("pubsub-inventory")
    .unmarshal().json(Map.class)
    .log("Inventory: checking stock for order ${body[order_id]}")
    .to("direct:check-inventory");

// Subscriber 2 — notification (different consumer group)
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=notification-service")
    .routeId("pubsub-notification")
    .unmarshal().json(Map.class)
    .log("Notification: sending confirmation for order ${body[order_id]}")
    .to("direct:send-confirmation");

// Subscriber 3 — analytics (added later, zero changes to publisher)
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=analytics-service")
    .routeId("pubsub-analytics")
    .unmarshal().json(Map.class)
    .log("Analytics: recording order ${body[order_id]}")
    .to("direct:record-analytics");
```

Notice that adding the analytics subscriber required zero changes to the publisher or the existing subscribers. This is the power of publish-subscribe: subscribers are additive. In a monolithic architecture, adding analytics would mean modifying order-service to call a new endpoint. In an event-driven architecture, it's a new consumer group.

## Pattern: Datatype Channel

### The problem

The `eip.orders.placed` topic carries `OrderPlaced` events — always the same structure, always Avro-serialized with the `eip.order.v1.OrderPlaced` schema. But what if you have a generic `eip.orders` topic that could carry `OrderPlaced`, `OrderCancelled`, `OrderUpdated`, and `OrderRefunded` events — all different schemas? Consumers need to know what type of message they're receiving before they can deserialize and process it.

You could inspect the raw bytes and guess, or you could establish a convention: one channel carries one data type. That's a Datatype Channel.

### The solution

A **Datatype Channel** is a channel where every message conforms to a single, known data type. The channel name itself communicates the schema — if you're reading from `eip.orders.placed`, you know every message is an `OrderPlaced`. There's no type-sniffing, no switch-on-type, no deserialization guesswork.

Our shipping domain follows this convention rigorously:

| Channel | Data Type | Schema |
|---------|-----------|--------|
| `eip.orders.placed` | `OrderPlaced` | `eip.order.v1.OrderPlaced` |
| `eip.orders.cancelled` | `OrderCancelled` | `eip.order.v1.OrderCancelled` |
| `eip.inventory.reserved` | `InventoryReserved` | `eip.inventory.v1.InventoryReserved` |
| `eip.payments.processed` | `PaymentProcessed` | `eip.payment.v1.PaymentProcessed` |

The alternative — a single `eip.events` topic carrying all event types — would force every consumer to deserialize, inspect a `type` field, and dispatch accordingly. That works, but it pushes routing logic into every consumer. Datatype channels move that routing to the infrastructure layer, where it belongs.

### How Camel models it

With datatype channels, each Camel consumer route handles exactly one event type. No type-checking, no dispatching — the channel guarantees the type:

```java
// Each route consumes from a datatype channel — no type dispatch needed
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("datatype-channel-placed")
    .unmarshal().json(Map.class)
    // We KNOW this is an OrderPlaced — the channel guarantees it
    .log("Processing OrderPlaced: ${body[order_id]}")
    .to("direct:reserve-inventory");

from("kafka:eip.orders.cancelled?brokers=localhost:9092&groupId=inventory-service")
    .routeId("datatype-channel-cancelled")
    .unmarshal().json(Map.class)
    // We KNOW this is an OrderCancelled
    .log("Processing OrderCancelled: ${body[order_id]}")
    .to("direct:release-inventory");
```

### Datatype channels and schema registries

Datatype channels pair naturally with a schema registry like Apicurio. When every message on `eip.orders.placed` conforms to the `OrderPlaced` schema, the registry can enforce compatibility rules per-topic. Apicurio's default **backward compatibility** mode means new versions of the schema can add fields with defaults but can't remove or rename fields — guaranteeing that existing consumers continue to work.

Without datatype channels (a single topic with mixed types), the registry would need per-message-type compatibility rules on the same topic — which most registries don't support cleanly.

## Choosing between the patterns

| Dimension | Point-to-Point | Publish-Subscribe | Datatype Channel |
|-----------|---------------|-------------------|------------------|
| **Delivery** | One consumer per message | All subscribers get every message | Orthogonal — applies to either |
| **Scaling** | More consumers = higher throughput | More subscribers = more fan-out | — |
| **Use case** | Work distribution, command processing | Event notification, broadcasting | Schema enforcement, clean routing |
| **Kafka** | Single consumer group | Multiple consumer groups | One topic per event type |
| **Pulsar** | Shared/failover subscription | Multiple subscriptions | One topic per event type |

Datatype channels are orthogonal to the other two — you can have a point-to-point datatype channel or a publish-subscribe datatype channel. In our shipping domain, `eip.orders.placed` is all three: it's a datatype channel (only `OrderPlaced` events), consumed point-to-point within a service (single consumer group), and publish-subscribe across services (multiple consumer groups).

## Common pitfalls

**Using a single "events" topic for everything.** It seems simpler — one topic, one consumer, dispatch by type — but it forces every consumer to handle every event type, even ones it doesn't care about. It also prevents Kafka from scaling different event types independently (high-volume events share partitions with low-volume events).

**Confusing Kafka topics with queues.** A Kafka topic is not a queue. Consuming a message doesn't delete it. Multiple consumer groups can read the same messages independently. If you want queue-like behavior (process-and-delete), use consumer groups with auto-commit — but understand that the messages remain on the topic until retention expires.

**Not setting a consumer group.** If you connect a Kafka consumer without a `groupId`, Camel auto-generates one. Each restart gets a new group, which means the consumer replays from the beginning (or misses messages, depending on `auto.offset.reset`). Always set an explicit, stable `groupId`.

## Runtime configuration

The channel patterns above use the same Camel Java DSL on both Quarkus and Spring Boot. The differences are in project setup and configuration:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties
quarkus.application.name=eip-channel-types
kafka.brokers=localhost:9092
camel.component.pulsar.service-url=pulsar://localhost:6650
quarkus.redis.hosts=redis://localhost:6379
quarkus.http.port=8082
quarkus.kafka.devservices.enabled=false
quarkus.log.category."org.apache.camel".level=INFO
```

```properties
# Spring Boot — application.properties
spring.application.name=eip-channel-types
kafka.brokers=localhost:9092
camel.component.pulsar.service-url=pulsar://localhost:6650
spring.data.redis.host=localhost
spring.data.redis.port=6379
server.port=8082
logging.level.org.apache.camel=INFO
```

The `kafka.brokers` and `camel.component.pulsar.service-url` property placeholders are shared — both runtimes resolve `{% raw %}{{kafka.brokers}}{% endraw %}` from the same key. The Redis configuration differs: Quarkus uses `quarkus.redis.hosts` (full URL), while Spring Boot uses `spring.data.redis.host` and `spring.data.redis.port`.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 4: "Messaging Channels"
- [enterpriseintegrationpatterns.com — Point-to-Point Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html)
- [enterpriseintegrationpatterns.com — Publish-Subscribe Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PublishSubscribeChannel.html)
- [enterpriseintegrationpatterns.com — Datatype Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DatatypeChannel.html)
- [Apache Camel — Kafka Component](https://camel.apache.org/components/4.20.x/kafka-component.html)
- [Apache Camel — Pulsar Component](https://camel.apache.org/components/4.20.x/pulsar-component.html)

## What you learned

- **Point-to-Point Channel** distributes messages across competing consumers — essential for work distribution and non-idempotent processing.
- **Publish-Subscribe Channel** delivers every message to every subscriber — the foundation of event-driven, loosely coupled architectures.
- **Datatype Channel** constrains each channel to a single message type — enabling clean routing, schema enforcement, and registry integration.
- Kafka achieves point-to-point with consumer groups and pub-sub with multiple groups on the same topic; Pulsar uses subscription types.

Next, we tackle what happens when things go wrong — invalid messages, dead letters, and guaranteed delivery.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0. YAML DSL routes provided for Camel CLI.*
