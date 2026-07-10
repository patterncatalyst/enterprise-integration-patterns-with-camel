---
title: "Channel Types"
order: 4
part: messaging-channels
description: "Point-to-point, publish-subscribe, and datatype channels — the three fundamental channel patterns that determine how messages are delivered."
duration: "35 minutes"
---

The previous chapter introduced the Message Channel as one of six building blocks. But not all channels behave the same way. The most important design decision in any messaging architecture is the channel type: does a message go to *one* consumer or to *all* consumers? This chapter covers the three channel patterns that answer that question, shows how Kafka and Pulsar implement each one, and demonstrates how Camel routes connect to them.

## Pattern: Point-to-Point Channel

### The problem

When an `OrderPlaced` event arrives, the inventory-service needs to check stock and reserve it. If you're running three instances of inventory-service for throughput, each order must be processed by exactly one instance. If all three process the same order, you'll triple-decrement the stock and corrupt your inventory.

You need a channel where messages are distributed *across* consumers, not duplicated *to* consumers.

### The solution

A **Point-to-Point Channel** ensures that each message is consumed by exactly one receiver. If multiple consumers are connected to the channel, they compete — the messaging system delivers each message to one and only one of them. This is sometimes called a **competing consumers** pattern (covered in more detail in Part 7).

The key guarantee: at-most-one *consumer* will process each message (assuming no redelivery). This is fundamental for any operation that isn't idempotent — like decrementing inventory.

### How Kafka implements it

In Kafka, point-to-point semantics come from the **consumer group**. All consumers with the same `group.id` form a group, and Kafka assigns each partition to exactly one consumer in the group. A message on a given partition is delivered to only one consumer:

```
Topic: eip.orders.placed (3 partitions)

Consumer Group: inventory-service
  ├── Instance A  ←  Partition 0
  ├── Instance B  ←  Partition 1
  └── Instance C  ←  Partition 2

Each order goes to exactly one instance.
```

If Instance B crashes, Kafka reassigns Partition 1 to Instance A or C (a **rebalance**). No messages are lost; processing continues with the surviving instances.

### How Pulsar implements it

In Pulsar, point-to-point semantics come from **subscription types**:

- **Exclusive subscription** — Only one consumer is allowed. A second consumer attempting to subscribe is rejected. Simple but no scaling.
- **Failover subscription** — One active consumer; others are standby. If the active consumer disconnects, a standby takes over.
- **Shared subscription** — Messages are round-robin distributed across all consumers in the subscription. This is the closest analog to Kafka's consumer group.
- **Key-shared subscription** — Like shared, but messages with the same key always go to the same consumer. Preserves per-key ordering while scaling horizontally.

### How Camel models it

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

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

```yaml
# Kafka point-to-point
- route:
    id: point-to-point-kafka
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "inventory-service"
        autoOffsetReset: earliest
        maxPollRecords: 10
    steps:
      - unmarshal:
          json: {}
      - log:
          message: "Instance processing order ${body[order_id]}"
      - to:
          uri: "direct:check-inventory"

# Pulsar point-to-point
- route:
    id: point-to-point-pulsar
    from:
      uri: "pulsar:persistent://public/default/eip.orders.placed"
      parameters:
        subscriptionName: "inventory-service"
        subscriptionType: "Shared"
    steps:
      - log:
          message: "Instance processing order from Pulsar"
      - to:
          uri: "direct:check-inventory"
```

```xml
<!-- Kafka point-to-point -->
<route id="point-to-point-kafka">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=inventory-service&amp;autoOffsetReset=earliest&amp;maxPollRecords=10"/>
  <unmarshal><json/></unmarshal>
  <log message="Instance processing order ${body[order_id]}"/>
  <to uri="direct:check-inventory"/>
</route>

<!-- Pulsar point-to-point -->
<route id="point-to-point-pulsar">
  <from uri="pulsar:persistent://public/default/eip.orders.placed?subscriptionName=inventory-service&amp;subscriptionType=Shared"/>
  <log message="Instance processing order from Pulsar"/>
  <to uri="direct:check-inventory"/>
</route>
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

```
Topic: eip.orders.placed (3 partitions)

Consumer Group: inventory-service
  └── Instance A  ←  All 3 partitions

Consumer Group: notification-service
  └── Instance A  ←  All 3 partitions

Consumer Group: analytics-service    (added later — no changes anywhere else)
  └── Instance A  ←  All 3 partitions

Each group gets EVERY message. Within a group, messages are distributed.
```

This is elegant: the same topic supports both point-to-point (within a group) and publish-subscribe (across groups) simultaneously. The publisher doesn't know or care how many groups are listening.

### How Pulsar implements it

In Pulsar, each **subscription** to a topic is an independent subscriber. Multiple subscriptions on the same topic give you publish-subscribe:

```
Topic: persistent://public/default/eip.orders.placed

Subscription: inventory-service (Shared)
  └── Consumer A

Subscription: notification-service (Exclusive)
  └── Consumer A

Subscription: analytics-service (Exclusive)
  └── Consumer A

Each subscription gets EVERY message independently.
```

### How Camel models it

The publisher route is the same regardless of how many consumers exist — that's the whole point of publish-subscribe:

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

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

```yaml
# Publisher
- route:
    id: pubsub-publisher
    from:
      uri: "direct:publish-order"
    steps:
      - marshal:
          json: {}
      - to:
          uri: "kafka:eip.orders.placed"
          parameters:
            brokers: "localhost:9092"

# Subscriber 1 — inventory
- route:
    id: pubsub-inventory
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "inventory-service"
    steps:
      - unmarshal:
          json: {}
      - log:
          message: "Inventory: checking stock for order ${body[order_id]}"
      - to:
          uri: "direct:check-inventory"

# Subscriber 2 — notification
- route:
    id: pubsub-notification
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "notification-service"
    steps:
      - unmarshal:
          json: {}
      - log:
          message: "Notification: sending confirmation for order ${body[order_id]}"
      - to:
          uri: "direct:send-confirmation"
```

```xml
<!-- Publisher -->
<route id="pubsub-publisher">
  <from uri="direct:publish-order"/>
  <marshal><json/></marshal>
  <to uri="kafka:eip.orders.placed?brokers=localhost:9092"/>
</route>

<!-- Subscriber 1 — inventory -->
<route id="pubsub-inventory">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=inventory-service"/>
  <unmarshal><json/></unmarshal>
  <log message="Inventory: checking stock for order ${body[order_id]}"/>
  <to uri="direct:check-inventory"/>
</route>

<!-- Subscriber 2 — notification -->
<route id="pubsub-notification">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=notification-service"/>
  <unmarshal><json/></unmarshal>
  <log message="Notification: sending confirmation for order ${body[order_id]}"/>
  <to uri="direct:send-confirmation"/>
</route>
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

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

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

```yaml
# OrderPlaced handler — channel guarantees the type
- route:
    id: datatype-channel-placed
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "inventory-service"
    steps:
      - unmarshal:
          json: {}
      - log:
          message: "Processing OrderPlaced: ${body[order_id]}"
      - to:
          uri: "direct:reserve-inventory"

# OrderCancelled handler — separate channel, separate type
- route:
    id: datatype-channel-cancelled
    from:
      uri: "kafka:eip.orders.cancelled"
      parameters:
        brokers: "localhost:9092"
        groupId: "inventory-service"
    steps:
      - unmarshal:
          json: {}
      - log:
          message: "Processing OrderCancelled: ${body[order_id]}"
      - to:
          uri: "direct:release-inventory"
```

```xml
<route id="datatype-channel-placed">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=inventory-service"/>
  <unmarshal><json/></unmarshal>
  <log message="Processing OrderPlaced: ${body[order_id]}"/>
  <to uri="direct:reserve-inventory"/>
</route>

<route id="datatype-channel-cancelled">
  <from uri="kafka:eip.orders.cancelled?brokers=localhost:9092&amp;groupId=inventory-service"/>
  <unmarshal><json/></unmarshal>
  <log message="Processing OrderCancelled: ${body[order_id]}"/>
  <to uri="direct:release-inventory"/>
</route>
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

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Pulsar component URI syntax matches camel-pulsar 4.20; subscriptionType parameter accepts "Shared"; Kafka consumer group behavior described matches actual Kafka 3.x semantics; multiple consumer groups on the same topic do receive independent copies.*
