---
title: "Appendix P: Kafka Share Groups"
order: 34
part: appendices
description: "KIP-932 share groups bring queue semantics to Kafka — per-message acknowledgment, competing consumers without partition coupling, and the KafkaShareConsumer API."
duration: "20 minutes"
---

Traditional Kafka consumer groups tie each partition to exactly one consumer. This works well when per-key ordering matters, but creates friction when you want simple work distribution — the "queue" pattern where any available consumer picks up the next message. KIP-932 introduces **share groups**, a new consumer group type that decouples consumption from partition assignment and adds per-message acknowledgment.

## The problem with consumer groups for queues

In a standard consumer group, partition assignment is exclusive:

```
Topic: eip.orders.placed (3 partitions)
Consumer Group: order-processors

  Consumer A → P0
  Consumer B → P1
  Consumer C → P2
  Consumer D → (idle — no partition available)
```

This creates three constraints:

1. **Consumer count is capped by partition count.** Consumer D is idle because there are only 3 partitions. Scaling consumers requires repartitioning the topic.

2. **Uneven partitions cause hot spots.** If P0 receives 80% of the traffic (due to key distribution), Consumer A is overwhelmed while B and C are underutilized.

3. **Rebalances are disruptive.** Adding or removing consumers triggers a rebalance that pauses all consumers in the group, even those whose partitions don't change.

For workloads that don't require per-key ordering — like dispatching notification emails, running fraud checks, or processing independent payments — these constraints are artificial. What you want is a message queue: any available consumer takes the next message.

## What share groups provide

A share group delivers messages from all partitions to all consumers in a round-robin fashion, with per-message acknowledgment:

```
Topic: eip.orders.placed (3 partitions)
Share Group: order-processors

  Consumer A ← messages from P0, P1, P2 (round-robin)
  Consumer B ← messages from P0, P1, P2 (round-robin)
  Consumer C ← messages from P0, P1, P2 (round-robin)
  Consumer D ← messages from P0, P1, P2 (round-robin)
```

Key differences from consumer groups:

| Feature | Consumer group | Share group |
|---------|---------------|-------------|
| Partition assignment | Exclusive (1 consumer per partition) | Shared (all consumers see all partitions) |
| Consumer scaling | Limited by partition count | Independent of partition count |
| Message delivery | Offset-based (in order) | Per-message (out of order possible) |
| Acknowledgment | Offset commit (batch) | Per-message (ACCEPT, REJECT, RELEASE) |
| Ordering guarantee | Per-partition | None (by design) |
| Rebalancing | Full group rebalance | No rebalancing needed |

## Per-message acknowledgment

Share groups replace offset-based commits with three per-message acknowledgment actions:

### ACCEPT

The message has been successfully processed. The broker marks it as consumed and will not redeliver it.

### REJECT

The message cannot be processed (bad data, validation failure). The broker moves it to a dead letter topic or discards it, depending on configuration. It will not be redelivered.

### RELEASE

The consumer cannot process the message right now (downstream service unavailable, temporary resource constraint). The broker returns the message to the pool for another consumer to pick up.

```java
// Conceptual Camel route with share group acknowledgment
from("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&groupId=order-processors"
        + "&groupType=share")
    .routeId("share-group-consumer")
    .unmarshal().json(java.util.Map.class)
    .doTry()
        .bean(orderService, "process")
        // ACCEPT: Camel commits on successful processing
    .doCatch(ValidationException.class)
        .log("Invalid order — rejecting: ${exception.message}")
        // REJECT: message will not be retried
    .doCatch(ServiceUnavailableException.class)
        .log("Service unavailable — releasing for retry")
        // RELEASE: message returns to the pool
    .end();
```

## Share group configuration

### group.type

Distinguishes share groups from traditional consumer groups. Set to `share` to enable share group semantics:

```properties
group.type=share
```

### share.auto.offset.reset

Controls where the share group starts consuming when no prior state exists:

| Value | Behavior |
|-------|----------|
| `earliest` | Start from the oldest available message |
| `latest` (default) | Start from the most recent message |

### share.group.delivery.count.limit

Maximum number of times a message can be delivered before it is automatically rejected. This prevents poison messages from cycling endlessly:

```properties
# After 5 delivery attempts, the message is rejected
share.group.delivery.count.limit=5
```

### Record lock duration

When a share group consumer receives a message, it acquires a lock. If the consumer doesn't acknowledge the message within the lock duration, the message is released for another consumer:

```properties
# Lock held for 30 seconds before automatic release
share.group.record.lock.duration.ms=30000
```

## When to use share groups vs. consumer groups

Share groups are not a replacement for consumer groups. They serve different workload patterns:

### Use consumer groups when

- **Per-key ordering matters**: all events for order 42 must be processed in sequence. Consumer groups with key-based partitioning guarantee this.
- **Exactly-once semantics**: consumer groups support Kafka transactions and offset-based EOS. Share groups do not.
- **Stateful processing**: aggregating events by key requires that all events for a key arrive at the same consumer.

### Use share groups when

- **Work distribution without ordering**: sending notification emails, running independent fraud checks, processing images — any workload where messages are independent.
- **Elastic scaling**: you need to scale consumers up and down without repartitioning topics or waiting through rebalances.
- **Uneven partition load**: your key distribution creates hot partitions, and you'd rather distribute work evenly than repartition.

### Shipping domain examples

| Workload | Group type | Reason |
|----------|-----------|--------|
| Order event processing | Consumer group | Per-order ordering required |
| Inventory reservation | Consumer group | Must process reserve/release in order per SKU |
| Notification dispatch | Share group | Emails are independent — any consumer can send any email |
| Fraud scoring | Share group | Each order scored independently — no ordering needed |
| Label generation | Share group | Printing labels is independent — distribute evenly |
| Payment processing | Consumer group | Payment state transitions require ordering |

## Share groups and the Competing Consumers pattern

Chapter 14 covered the Competing Consumers pattern using Kafka consumer groups. Share groups are a more natural fit for this pattern because they provide actual competing consumption — consumers compete for individual messages rather than competing for partition assignments.

With consumer groups, "competing consumers" is a misnomer: consumers don't compete for messages, they each own a fixed set of partitions. The competition happens only during rebalancing. Share groups make the competition continuous and per-message.

```java
// Competing Consumers with share groups — natural queue semantics
from("kafka:eip.notifications.outbound"
        + "?brokers={{kafka.brokers}}"
        + "&groupId=notification-workers"
        + "&groupType=share")
    .routeId("notification-worker")
    .unmarshal().json(java.util.Map.class)
    .bean(notificationService, "send")
    .log("Notification sent for order ${body[order_id]}");
```

Scale by adding more instances of this route — each instance automatically receives a share of the messages without partition assignment or rebalancing.

## Availability

Share groups were introduced in KIP-932 and are available as an early access feature in Apache Kafka 4.0. They require broker-side configuration to enable. At the time of writing, the feature is not yet stable — expect API changes before it reaches GA.

When share groups stabilize, they will be a significant addition to Kafka's messaging model, bridging the gap between Kafka's log-based architecture and traditional message queue semantics. Until then, the consumer group approach from Chapter 14 remains the production-ready path for competing consumers on Kafka.

For workloads that need queue semantics today, Pulsar's Shared subscription (Appendix C) provides a mature, production-ready alternative.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: KIP-932 share groups are an early access feature in Apache Kafka 4.0; the `group.type=share` configuration property exists; `share.group.delivery.count.limit` and `share.group.record.lock.duration.ms` are valid broker-side properties; Camel Kafka component supports `groupType` parameter or equivalent configuration.*
