---
title: "Appendix B: Kafka Deep Dive"
order: 20
part: appendices
description: "Topics, partitions, consumer groups, exactly-once semantics, and Kafka operational patterns for integration architects."
duration: "25 minutes"
---

Kafka is the backbone of the shipping domain's event-driven architecture. This appendix covers the Kafka concepts that integration architects need beyond the basics — partitioning strategy, consumer group mechanics, exactly-once delivery, and operational patterns.

The code is in `examples/20-kafka-deep-dive/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/20-kafka-deep-dive/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/20-kafka-deep-dive/spring-boot
mvn spring-boot:run
```

## Architecture recap

{% include excalidraw.html file="20-kafka-architecture" alt="Kafka cluster architecture" caption="Figure K.1 — Kafka cluster with KRaft, partitions, and consumer groups" %}

In our compose stack, we run a single KRaft broker (no ZooKeeper). In production, you'd run 3+ brokers for fault tolerance.

## Partitioning strategy

### Key-based partitioning

When a producer sends a message with a key, Kafka hashes the key to determine the partition:

```
key = "order-42" → hash("order-42") % 3 = partition 1
key = "order-43" → hash("order-43") % 3 = partition 0
key = "order-42" → hash("order-42") % 3 = partition 1  (same key = same partition)
```

Same key = same partition = guaranteed ordering within a key. This is critical for our domain:
- All events for order 42 (`OrderPlaced`, `InventoryReserved`, `PaymentProcessed`) go to the same partition.
- A consumer processing partition 1 sees these events in order.

In Camel:
```java
.to("kafka:eip.orders.placed?brokers=localhost:9092&key=${header.orderId}");
```

### Partition count planning

| Factor | Guideline |
|--------|-----------|
| **Consumer parallelism** | Max consumers = partition count. Plan for peak concurrency. |
| **Throughput target** | Each partition handles ~10 MB/s write. 30 MB/s target → 3+ partitions. |
| **Ordering scope** | More partitions = ordering only within each partition (per-key). |
| **Future growth** | Adding partitions later redistributes keys — existing key→partition mappings change. |

For our tutorial stack: 3 partitions per topic (matches the single-broker dev setup). For production: 6-12 partitions per high-volume topic.

## Consumer group mechanics

### Rebalancing

When a consumer joins or leaves a group, Kafka redistributes partitions:

{% include excalidraw.html file="20-consumer-rebalancing" alt="Three rebalancing scenarios: initial 2-consumer assignment, after Consumer C joins (3-way split), and after Consumer B crashes (2-way redistribution)" caption="Figure B.1 — Consumer group rebalancing: partitions are redistributed when consumers join or leave the group." %}

During rebalance, consumers pause processing (~seconds). Camel's Kafka component handles rebalancing automatically — but your processing logic must be idempotent because messages may be re-delivered during rebalance.

### Offset management

Kafka stores committed offsets per (group, topic, partition):

```
Group: inventory-service
  eip.orders.placed / P0: offset 1042
  eip.orders.placed / P1: offset 987
  eip.orders.placed / P2: offset 1103
```

The committed offset is the *last successfully processed* message. On restart, the consumer resumes from offset + 1.

**Auto-commit** commits periodically (default 5s). **Manual commit** commits after processing. The gap between processing and commit determines your delivery guarantee:

| Timing | Guarantee | Risk |
|--------|-----------|------|
| Commit before processing | At-most-once | Process failure loses messages |
| Commit after processing | At-least-once | Crash between process and commit → redelivery |
| Kafka transactions | Exactly-once | Complex, higher latency |

## Exactly-once semantics (EOS)

Kafka supports exactly-once through **idempotent producers** + **transactional consumers**:

### Idempotent producer

```properties
# application.properties
camel.component.kafka.additional-properties.enable.idempotence=true
camel.component.kafka.additional-properties.acks=all
camel.component.kafka.additional-properties.max.in.flight.requests.per.connection=5
```

With idempotence enabled, Kafka deduplicates messages from the same producer session. Retries don't create duplicates.

### Transactional produce-consume

For consume-transform-produce patterns (read from topic A, process, write to topic B), Kafka transactions ensure atomicity:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=transform-service"
        + "&isolationLevel=read_committed")
    .routeId("transactional-pipeline")
    .unmarshal().json(Map.class)
    .to("direct:transform-order")
    .marshal().json()
    .to("kafka:eip.orders.transformed?brokers=localhost:9092"
        + "&transactionalId=transform-service-tx");
```

### Practical EOS: outbox + idempotent consumer

In practice, most teams use at-least-once delivery with application-level deduplication (the outbox pattern + idempotent receiver from Chapter 15) rather than Kafka's built-in EOS. The reasons:

1. EOS doesn't span external systems (databases, HTTP APIs).
2. The outbox pattern gives transactional guarantees across Kafka and PostgreSQL.
3. Idempotent receivers are simpler to reason about than Kafka transactions.

## Topic configuration for EIP

Key topic-level settings for integration patterns:

```bash
# Create a topic with production settings
kafka-topics.sh --create \
  --topic eip.orders.placed \
  --partitions 6 \
  --replication-factor 3 \
  --config retention.ms=604800000 \        # 7 days
  --config cleanup.policy=delete \          # delete old segments
  --config min.insync.replicas=2 \          # require 2 replicas for acks=all
  --config max.message.bytes=1048576 \      # 1 MB max message
  --config compression.type=lz4            # compress at broker level
```

| Setting | Pattern impact |
|---------|---------------|
| `retention.ms` | How long messages are available for replay (Message Store, Durable Subscriber) |
| `cleanup.policy=compact` | Keep only the latest value per key (useful for state topics) |
| `min.insync.replicas` | With `acks=all`, ensures N replicas acknowledged (Guaranteed Delivery) |
| `max.message.bytes` | Limits message size (affects Message Sequence threshold) |

## Configuring the client: `spring.kafka.*` on Spring Boot

Every Kafka example in this tutorial configures the component the Camel way, on
both runtimes:

```properties
camel.component.kafka.brokers=localhost:9092
```

On Spring Boot there is a second, more idiomatic option as of Camel 4.21. With
`camel-kafka-starter` on the classpath, the standard `spring.kafka.*` properties
are bridged to the Camel Kafka component automatically:

```properties
spring.kafka.bootstrap-servers=localhost:9092
spring.kafka.security.protocol=SASL_SSL
spring.kafka.consumer.group-id=inventory-service
spring.kafka.ssl.trust-store-location=classpath:kafka.truststore.jks
```

This matters more than it first appears. A Spring Boot application that already
talks to Kafka — through Spring Kafka, or through Spring Cloud Stream — has all
of this configured already, frequently including the fiddly parts: SASL
mechanisms, TLS trust stores, client IDs. Bridging means Camel picks those up
rather than making you restate them under a second prefix and keep the two in
sync.

Explicit `camel.component.kafka.*` properties still win where both are set, so
you can bridge the common configuration and override one thing. To turn the
bridge off entirely:

```properties
camel.component.kafka.bridge-spring-kafka-properties=false
```

There is no Quarkus equivalent, and there does not need to be — Quarkus
applications configure the Camel component directly, which is what the examples
here do.

## Monitoring Kafka with Camel

Our stack includes Kafka UI at `http://localhost:8090`. For programmatic monitoring:

```java
// Monitor consumer lag via JMX beans
from("timer:kafka-lag-check?period=60000")
    .routeId("consumer-lag-monitor")
    .process(exchange -> {
        // Use Kafka AdminClient to check consumer group lag
        // Alert if lag exceeds threshold
    })
    .choice()
        .when(header("lagExceedsThreshold").isEqualTo(true))
            .to("direct:alert-high-lag")
    .end();
```

Key metrics to watch:
- **Consumer lag** — Messages produced but not yet consumed. High lag = consumer falling behind.
- **Under-replicated partitions** — Replicas out of sync. Indicates broker issues.
- **Request latency** — Producer/consumer round-trip time. High latency = broker overload.

---

*Verification status: <span class="status status--verified">verified</span> — both runtime variants build against Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1) and their 4 Citrus integration tests pass against live containers on Docker Engine (2026-10-09).*
