---
title: "Appendix C: Pulsar Deep Dive"
order: 21
part: appendices
description: "Topics, subscriptions, schema registry, per-message TTL, and Pulsar's unique capabilities for integration patterns."
duration: "30 minutes"
---

Apache Pulsar appears in this tutorial wherever its features provide a better fit than Kafka: per-message TTL (Message Expiration), key-shared subscriptions (ordered competing consumers), and native schema enforcement. This appendix covers the Pulsar concepts that differentiate it from Kafka and how Camel integrates with them.

The code is in `examples/21-pulsar-deep-dive/`. The `README.md` there covers how to run it.

## Architecture

Pulsar separates serving (brokers) from storage (BookKeeper):

{% include excalidraw.html file="21-pulsar-architecture" alt="Pulsar cluster architecture" caption="Figure L.1 — Pulsar cluster with stateless brokers and BookKeeper storage" %}

A production Pulsar cluster has three distinct layers:

| Component | Role | Scaling |
|-----------|------|---------|
| **Brokers** | Serve producers and consumers, dispatch messages, enforce schemas | Stateless — add or remove without data migration |
| **Bookies** (BookKeeper) | Persist messages in append-only ledgers across multiple nodes | Stateful — data is replicated across bookies automatically |
| **Metadata store** (ZooKeeper or etcd) | Cluster coordination, topic ownership, schema storage | 3- or 5-node quorum |

The key architectural advantage is that brokers are stateless. When a broker fails, another broker takes over the topic immediately — there is no partition reassignment delay like Kafka rebalances. Scaling up means adding brokers; the load balancer redistributes topic ownership without data movement.

Our Podman stack runs Pulsar in **standalone mode** — a single process that embeds a broker, bookie, and ZooKeeper. This is fine for development but not for production.

## Topic structure

Pulsar topics have a hierarchical naming scheme:

```
persistent://tenant/namespace/topic-name
```

- **Tenant** — Top-level isolation unit (e.g., `public`, `shipping-platform`).
- **Namespace** — Logical grouping within a tenant. Policies (retention, TTL, schema compatibility) are set at the namespace level.
- **Topic name** — The individual topic (e.g., `eip.orders.placed`).

### Persistent vs. non-persistent topics

| Type | URI prefix | Durability | Use case |
|------|-----------|------------|----------|
| **Persistent** | `persistent://` | Messages stored in BookKeeper until consumed and acknowledged | Order events, payment confirmations — anything that cannot be lost |
| **Non-persistent** | `non-persistent://` | Messages held in broker memory only; lost on broker restart | Real-time metrics, heartbeat signals — high throughput, tolerable loss |

In Camel, the topic URI determines persistence — just swap the prefix:

```java
// Durable order events
from("pulsar:persistent://public/default/eip.orders.placed"
        + "?subscriptionName=inventory-service&subscriptionType=Shared")
    .to("direct:check-inventory");

// Ephemeral tracking pings (loss on broker restart is acceptable)
from("pulsar:non-persistent://public/default/eip.tracking.pings"
        + "?subscriptionName=tracking-dashboard&subscriptionType=Shared")
    .to("direct:update-dashboard");
```

### Partitioned topics

Topics can optionally be partitioned (`pulsar-admin topics create-partitioned-topic --partitions 6`), but unlike Kafka, partitioning is not required for parallelism. A non-partitioned topic can still be consumed by multiple consumers using Shared or Key_Shared subscriptions.

## Subscription types

Pulsar's subscription model is more flexible than Kafka's consumer groups:

| Subscription Type | Behavior | Kafka Equivalent | Use Case |
|-------------------|----------|-----------------|----------|
| **Exclusive** | One consumer; second connection is rejected | Single-partition consumer | Strict ordering, no scaling |
| **Failover** | One active, others standby; automatic failover | — (manual with Kafka) | High availability without scaling |
| **Shared** | Round-robin across consumers | Consumer group | Work distribution (Competing Consumers) |
| **Key-shared** | Same key always routes to same consumer | Consumer group with key partitioning | Ordered processing per key, scaled across keys |

**Exclusive** and **Failover** subscriptions are straightforward — set `subscriptionType=Exclusive` for strict single-consumer ordering (second connection is rejected) or `subscriptionType=Failover` for automatic standby promotion without Kafka-style rebalancing.

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

## Message retention and TTL

Pulsar provides two independent mechanisms for message lifecycle management:

### Retention policy

Retention controls how long *acknowledged* messages are kept. By default, acknowledged messages are deleted immediately. Setting a retention policy preserves them for replay:

```bash
# Keep acknowledged messages for 7 days or up to 10 GB
pulsar-admin namespaces set-retention public/default \
  --size 10G --time 7d
```

This is useful for the Message Store pattern — consumers that join later can replay historical messages.

### Per-message TTL

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

### Backlog quotas

Backlog quotas limit how much unacknowledged data a subscription can accumulate before the broker takes action:

```bash
# Limit backlog to 1 GB; oldest messages are dropped when exceeded
pulsar-admin namespaces set-backlog-quota public/default \
  --limit 1G --policy producer_request_hold
```

Policies include `producer_request_hold` (block producers), `producer_exception` (reject new messages), and `consumer_backlog_eviction` (drop oldest unacked messages).

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

Schema compatibility is configured per namespace:

```bash
# Set schema compatibility strategy
pulsar-admin namespaces set-schema-compatibility-strategy \
  public/default --compatibility BACKWARD
```

- **BACKWARD** — New schema can read old data (add fields with defaults, don't remove fields).
- **FORWARD** — Old schema can read new data.
- **FULL** — Both backward and forward compatible.
- **ALWAYS_COMPATIBLE** — No compatibility checks (use during prototyping only).

Compared to Kafka, where a schema registry (Apicurio or Confluent) is a separate service you must deploy and configure, Pulsar's built-in registry reduces operational overhead.

## Pulsar Functions vs. Camel routes

Pulsar Functions are lightweight compute units that run inside the Pulsar cluster. They consume from one topic, transform, and produce to another — similar to a simple Camel route:

| Capability | Pulsar Functions | Camel Routes |
|------------|-----------------|--------------|
| Deployment | Inside the Pulsar cluster | Separate JVM (Quarkus) |
| Language | Java, Python, Go | Java DSL (any JVM language) |
| Complexity | Simple transforms, filters | Complex EIP orchestration |
| External systems | Limited (no built-in connectors) | 300+ Camel components |
| State | Built-in state store | External (Redis, PostgreSQL) |
| Testing | Pulsar test harness | Camel test kit, Quarkus @QuarkusTest |

Use Pulsar Functions for simple, stateless transforms close to the data (filtering, format conversion). Use Camel routes for EIP patterns, external system integration, and complex routing logic. Our shipping domain uses Camel routes exclusively because every processing step involves multiple systems.

## When to choose Pulsar over Kafka

| Feature | Kafka | Pulsar | Choose Pulsar when... |
|---------|-------|--------|----------------------|
| Per-message TTL | No (topic retention only) | Yes | Messages have expiration deadlines |
| Key ordering without partitions | No (partition-based) | Yes (key-shared) | You need key ordering with elastic scaling |
| Built-in schema registry | No (external: Apicurio/Confluent) | Yes | You want schema enforcement without extra infrastructure |
| Geo-replication | MirrorMaker (complex) | Built-in | Multi-datacenter is a requirement |
| Multi-tenancy | Topic-level ACLs | Namespace isolation | Shared cluster across teams |
| Tiered storage | KIP-405 (newer) | Mature | Long retention with cost-effective storage |
| Broker scaling | Requires partition rebalancing | Stateless, instant | Elastic workloads with unpredictable load |

In our shipping domain, Kafka is the primary broker. Pulsar is used selectively for per-message TTL (flash sale notifications) and key-shared subscriptions (when we need elastic ordered processing). The Messaging Bridge pattern (Chapter 06) connects the two.

## Production tuning

Key configuration areas when moving Pulsar beyond the development Podman stack:

### Broker and BookKeeper tuning

```properties
# Broker: dispatch rate limiting — prevent a single subscription from starving others
dispatchThrottlingRatePerTopicInMsg=1000
dispatchThrottlingRatePerSubscriptionInMsg=500

# BookKeeper: write quorum configuration
managedLedgerDefaultEnsembleSize=3    # bookies each entry is written to
managedLedgerDefaultAckQuorumSize=2   # bookies that must acknowledge
managedLedgerDefaultWriteQuorumSize=3 # copies maintained
```

With ensemble=3, write=3, ack=2, a write is confirmed when 2 of 3 bookies have persisted — balancing durability with latency.

### Client-side settings in Camel

```properties
# application.properties — Pulsar producer tuning
camel.component.pulsar.configuration.batching-enabled=true
camel.component.pulsar.configuration.batching-max-messages=1000
camel.component.pulsar.configuration.batching-max-publish-delay-micros=10000
camel.component.pulsar.configuration.compression-type=LZ4
```

Batching groups multiple messages into a single network request, reducing overhead for high-throughput topics like order events. LZ4 compression reduces network bandwidth with minimal CPU cost.

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
| `schemaType` | Schema type (`AVRO`, `JSON`, `PROTOBUF`, `BYTES`) | `BYTES` |
| `batchingEnabled` | Enable message batching for producers | `true` |

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Pulsar component `subscriptionType=Key_Shared` parameter is valid in Camel 4.20; `deadLetterTopic` and `maxRedeliverCount` parameters exist; `pulsar-admin namespaces set-message-ttl` command syntax is correct; standalone mode includes embedded bookie and ZooKeeper; `non-persistent://` topic URI is supported by the Camel Pulsar component; `set-retention`, `set-backlog-quota`, and `set-schema-compatibility-strategy` admin commands are correct.*
