---
title: "Appendix C: Pulsar Deep Dive"
order: 21
part: appendices
description: "Topics, subscriptions, schema registry, per-message TTL, and Pulsar's unique capabilities for integration patterns."
duration: "25 minutes"
---

Apache Pulsar appears in this tutorial wherever its features provide a better fit than Kafka: per-message TTL (Message Expiration), key-shared subscriptions (ordered competing consumers), and native schema enforcement. This appendix covers the Pulsar concepts that differentiate it from Kafka and how Camel integrates with them.

## Architecture

Pulsar separates serving (brokers) from storage (BookKeeper):

{% include excalidraw.html file="21-pulsar-architecture" alt="Pulsar cluster architecture" caption="Figure L.1 — Pulsar cluster with stateless brokers and BookKeeper storage" %}

Our Podman stack runs Pulsar in **standalone mode** — a single process that embeds a broker, bookie, and ZooKeeper. This is fine for development but not for production.

## Subscription types

Pulsar's subscription model is more flexible than Kafka's consumer groups:

| Subscription Type | Behavior | Kafka Equivalent | Use Case |
|-------------------|----------|-----------------|----------|
| **Exclusive** | One consumer; second connection is rejected | Single-partition consumer | Strict ordering, no scaling |
| **Failover** | One active, others standby; automatic failover | — (manual with Kafka) | High availability without scaling |
| **Shared** | Round-robin across consumers | Consumer group | Work distribution (Competing Consumers) |
| **Key-shared** | Same key always routes to same consumer | Consumer group with key partitioning | Ordered processing per key, scaled across keys |

### Key-shared subscriptions in Camel

Key-shared subscriptions give you per-key ordering *without* partitions. Unlike Kafka (where ordering depends on partition assignment, and repartitioning breaks key affinity), Pulsar routes by key at the subscription level:

```java
from("pulsar:persistent://public/default/eip.orders.placed"
        + "?subscriptionName=inventory-service"
        + "&subscriptionType=Key_Shared")
    .routeId("pulsar-key-shared")
    .log("Processing order — key ensures per-order ordering")
    .to("direct:check-inventory");
```

All events for order 42 go to the same consumer instance, regardless of how many instances are running. Adding or removing consumers doesn't break key affinity (unlike Kafka rebalances, which reassign partitions).

## Per-message TTL

Kafka has topic-level retention but no per-message expiration. Pulsar supports per-message TTL at the namespace level:

```bash
# Set 5-minute TTL on the namespace
pulsar-admin namespaces set-message-ttl public/default --messageTTL 300
```

Messages not acknowledged within the TTL are automatically moved to the dead letter topic. In Camel, this means your Message Expiration pattern (Chapter 08) is handled by the broker — no application-level timestamp checking needed:

```java
from("pulsar:persistent://public/default/eip.notifications.flash-sale"
        + "?subscriptionName=notification-service"
        + "&subscriptionType=Shared"
        + "&deadLetterTopic=persistent://public/default/eip.notifications.expired"
        + "&maxRedeliverCount=3"
        + "&ackTimeoutMillis=30000")
    .routeId("pulsar-ttl-consumer")
    .log("Processing flash sale notification (TTL enforced by Pulsar)")
    .to("direct:send-notification");
```

## Schema enforcement

Pulsar has a built-in schema registry (no external service needed). Schemas are enforced at the broker level — producers that send messages not conforming to the topic's schema are rejected:

```java
// Producer with Avro schema enforcement
from("direct:publish-order-avro")
    .routeId("pulsar-schema-producer")
    .marshal().avro("eip.order.v1.OrderPlaced")
    .to("pulsar:persistent://public/default/eip.orders.placed"
        + "?producerName=order-service"
        + "&schemaType=AVRO");
```

Schema compatibility is configured per topic:
- **BACKWARD** — New schema can read old data (add fields with defaults, don't remove fields).
- **FORWARD** — Old schema can read new data.
- **FULL** — Both backward and forward compatible.

## When to choose Pulsar over Kafka

| Feature | Kafka | Pulsar | Choose Pulsar when... |
|---------|-------|--------|----------------------|
| Per-message TTL | No (topic retention only) | Yes | Messages have expiration deadlines |
| Key ordering without partitions | No (partition-based) | Yes (key-shared) | You need key ordering with elastic scaling |
| Built-in schema registry | No (external: Apicurio/Confluent) | Yes | You want schema enforcement without extra infrastructure |
| Geo-replication | MirrorMaker (complex) | Built-in | Multi-datacenter is a requirement |
| Multi-tenancy | Topic-level ACLs | Namespace isolation | Shared cluster across teams |
| Tiered storage | KIP-405 (newer) | Mature | Long retention with cost-effective storage |

In our shipping domain, Kafka is the primary broker. Pulsar is used selectively for per-message TTL (flash sale notifications) and key-shared subscriptions (when we need elastic ordered processing). The Messaging Bridge pattern (Chapter 06) connects the two.

## Camel Pulsar component reference

Key parameters for the `pulsar:` component:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `subscriptionName` | Name of the subscription (durable) | — (required) |
| `subscriptionType` | `Exclusive`, `Failover`, `Shared`, `Key_Shared` | `Exclusive` |
| `producerName` | Named producer (for deduplication) | — |
| `numberOfConsumers` | Consumer threads | 1 |
| `ackTimeoutMillis` | Time before message is redelivered if not acked | 0 (disabled) |
| `deadLetterTopic` | Topic for messages exceeding max redelivery | — |
| `maxRedeliverCount` | Max redelivery attempts before dead letter | — |
| `negativeAckRedeliveryDelayMicros` | Delay before redelivery on negative ack | 60s |

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Pulsar component `subscriptionType=Key_Shared` parameter is valid in Camel 4.20; `deadLetterTopic` and `maxRedeliverCount` parameters exist; `pulsar-admin namespaces set-message-ttl` command syntax is correct; standalone mode includes embedded bookie and ZooKeeper.*
