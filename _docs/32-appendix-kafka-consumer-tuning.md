---
title: "Appendix N: Kafka Consumer Tuning"
order: 32
part: appendices
description: "Fetch sizes, poll intervals, offset commits, session timeouts, and static group membership for Camel Kafka consumers."
duration: "20 minutes"
---

Appendix B introduced Kafka's core concepts — partitions, consumer groups, offsets, and exactly-once semantics. This appendix focuses on the consumer side: the configuration properties that control throughput, latency, data safety, and rebalance behavior. Every property is shown in the context of Camel's Kafka component, with guidance for the shipping domain's workload profiles.

## The consumer lifecycle

A Kafka consumer cycles through three operations: **fetch** (pull batches from the broker), **poll** (deliver records to application code), and **commit** (acknowledge processed offsets). Each operation has configuration knobs that trade off throughput against latency and safety.

```
Broker                     Consumer
  │                           │
  │◄── fetch request ─────── │  (fetch.min.bytes, fetch.max.wait.ms)
  │── batch of records ─────►│
  │                           │── poll() returns records
  │                           │   (max.poll.records, max.poll.interval.ms)
  │                           │── process records
  │◄── commit offsets ─────── │  (enable.auto.commit, auto.commit.interval.ms)
  │── ack ──────────────────►│
  │                           │
```

## Throughput tuning — fetch thresholds

Two properties control how much data the broker accumulates before responding to a fetch request:

### fetch.min.bytes

The minimum number of bytes the broker should have available before responding. If the topic is producing slowly, the broker waits until this threshold is met (or `fetch.max.wait.ms` expires, whichever comes first).

| Value | Behavior |
|-------|----------|
| `1` (default) | Respond immediately with whatever is available — lowest latency |
| `16384` (16 KB) | Wait for a small batch — fewer requests, lower CPU overhead |
| `1048576` (1 MB) | Wait for a large batch — highest throughput, higher latency |

For the shipping domain's order pipeline (moderate volume, low-latency requirements): leave at the default `1`. For the nightly batch export (high volume, latency-tolerant): increase to `16384` or higher.

```properties
# application.properties — high-throughput consumer
camel.component.kafka.configuration.fetch-min-bytes=16384
```

### fetch.max.wait.ms

Maximum time the broker waits before responding, even if `fetch.min.bytes` hasn't been reached.

```properties
# Default 500ms — respond after half a second regardless of data volume
camel.component.kafka.configuration.fetch-wait-max-ms=500
```

The two properties interact as a "first wins" pair: the broker responds when either the byte threshold is met or the time threshold expires.

### fetch.max.bytes and max.partition.fetch.bytes

These cap how much data comes back in a single fetch:

| Property | Scope | Default |
|----------|-------|---------|
| `fetch.max.bytes` | Per fetch request (all partitions) | 50 MB |
| `max.partition.fetch.bytes` | Per partition | 1 MB |

**Memory planning formula**: the maximum memory a consumer can use for fetch buffers is approximately:

```
min(NUMBER_OF_BROKERS × fetch.max.bytes,
    NUMBER_OF_PARTITIONS × max.partition.fetch.bytes)
```

For our 3-partition, single-broker dev stack: `min(1 × 50MB, 3 × 1MB) = 3 MB`. For a production cluster with 3 brokers and 12 partitions per topic: `min(3 × 50MB, 12 × 1MB) = 12 MB`.

`max.partition.fetch.bytes` must be larger than the topic's `max.message.bytes` setting, or the consumer will fail to fetch large messages.

## Poll tuning — processing cadence

### max.poll.records

Maximum number of records returned per `poll()` call. This directly controls batch size for your processing logic.

```properties
# Default 500 — sensible for most workloads
camel.component.kafka.configuration.max-poll-records=500
```

| Scenario | Recommended value |
|----------|-------------------|
| Fast processing (< 1ms per record) | 500–1000 |
| Moderate processing (10–50ms per record) | 100–200 |
| Slow processing (HTTP calls, JDBC per record) | 10–50 |

The goal: complete processing of all records within `max.poll.interval.ms`. If processing takes longer, the broker considers the consumer dead and triggers a rebalance.

### max.poll.interval.ms

Maximum time between `poll()` calls before the consumer is removed from the group. Default: 300000 (5 minutes).

```properties
# Increase for slow-processing consumers
camel.component.kafka.configuration.max-poll-interval-ms=600000
```

If your order enrichment route calls three external services (inventory, payment, shipping) and each can take up to 30 seconds, processing 50 records could take 25 minutes. Set `max.poll.interval.ms` higher than the worst-case batch time, or reduce `max.poll.records` so batches finish faster.

A practical approach in Camel: reduce `max.poll.records` to 1–10 for I/O-heavy routes and keep `max.poll.interval.ms` at the default. This keeps batches small and predictable:

```java
from("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&groupId=enrichment-service"
        + "&maxPollRecords=10"
        + "&maxPollIntervalMs=300000")
    .routeId("tuned-order-enricher")
    .unmarshal().json(java.util.Map.class)
    .bean(inventoryService, "reserveStock")
    .bean(paymentService, "validate")
    .marshal().json()
    .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}");
```

## Offset commit strategies

### Auto-commit

With `enable.auto.commit=true` (the default), the consumer commits offsets every `auto.commit.interval.ms` (default 5 seconds). This creates two risk windows:

**Data loss**: consumer commits offset 100, then crashes before processing records 95–100. On restart, the consumer resumes from 101 — records 95–100 are lost.

**Data duplication**: consumer processes records 95–100, then crashes before the next auto-commit. On restart, the consumer resumes from the last committed offset (94) and reprocesses 95–100.

Reducing `auto.commit.interval.ms` shrinks these windows but doesn't eliminate them:

```properties
camel.component.kafka.configuration.auto-commit-interval-ms=1000
```

### Manual commit

For the shipping domain — where losing an order or processing a payment twice are both unacceptable — manual commit with at-least-once semantics plus idempotent receivers is the standard pattern:

```java
from("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&groupId=payment-service"
        + "&autoCommitEnable=false"
        + "&allowManualCommit=true")
    .routeId("manual-commit-consumer")
    .unmarshal().json(java.util.Map.class)
    .bean(paymentService, "processPayment")
    .process(exchange -> {
        var commit = exchange.getIn()
            .getHeader(org.apache.camel.component.kafka.KafkaConstants.MANUAL_COMMIT,
                org.apache.camel.component.kafka.KafkaManualCommit.class);
        commit.commit();
    })
    .marshal().json()
    .to("kafka:eip.orders.payment-confirmed?brokers={{kafka.brokers}}");
```

**Best practice**: use `commitAsync` by default for lower latency, but switch to `commitSync` before shutdown or rebalance to guarantee the final commit. Camel's `allowManualCommit=true` uses synchronous commit, which is the safer default.

### Transactional reads

When consuming from topics that are written transactionally (see Appendix B's EOS section), set `isolation.level` to `read_committed` to skip uncommitted or aborted records:

```properties
camel.component.kafka.configuration.isolation-level=read_committed
```

With `read_committed`, the consumer only sees records from completed transactions. With `read_uncommitted` (the default), all records are visible — including those from transactions that may be rolled back.

## Failure recovery — session and heartbeat

### session.timeout.ms

How long the broker waits without a heartbeat before marking the consumer as dead and triggering a rebalance. Default: 45000 (45 seconds).

```properties
camel.component.kafka.configuration.session-timeout-ms=45000
```

Lower values detect failures faster but risk false positives during GC pauses or network blips. Higher values tolerate transient issues but delay failover.

### heartbeat.interval.ms

How often the consumer sends heartbeats to the group coordinator. Default: 3000 (3 seconds). Must be less than `session.timeout.ms` — the standard recommendation is one-third of the session timeout:

```properties
camel.component.kafka.configuration.heartbeat-interval-ms=3000
```

The heartbeat thread runs independently of message processing. Even if your route is blocked on a slow HTTP call, heartbeats continue, keeping the consumer in the group. The consumer is removed only when heartbeats stop entirely (network partition, JVM crash) or when `max.poll.interval.ms` expires.

## Offset reset policy

### auto.offset.reset

What happens when a consumer starts with no committed offset (new group) or when the committed offset is no longer valid (data was deleted by retention):

| Value | Behavior |
|-------|----------|
| `latest` (default) | Start from the most recent message — skip history |
| `earliest` | Start from the oldest available message — replay everything |
| `none` | Throw an exception — fail fast if no offset exists |

```properties
camel.component.kafka.configuration.auto-offset-reset=earliest
```

For the shipping domain: `earliest` is safer for critical consumers (payment-service, inventory-service) because it replays missed messages after a clean group reset. `latest` is appropriate for monitoring and dashboarding consumers where historical data isn't needed.

## Minimizing rebalance impact

Rebalances pause all consumers in a group while partitions are redistributed. For high-throughput pipelines, every rebalance is a throughput gap.

### Static group membership

Assign each consumer a stable `group.instance.id`. When a consumer restarts with the same instance ID, the broker skips the rebalance and reassigns the same partitions immediately:

```java
from("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&groupId=inventory-service"
        + "&groupInstanceId=inventory-${HOSTNAME}"
        + "&sessionTimeoutMs=60000")
    .routeId("static-member-consumer")
    .unmarshal().json(java.util.Map.class)
    .to("direct:check-inventory");
```

With static membership, the broker waits `session.timeout.ms` before reassigning partitions from a departed consumer. This gives the consumer time to restart without triggering a rebalance. Set `session.timeout.ms` higher (e.g., 60 seconds) to accommodate rolling restarts.

### Cooperative rebalancing

Kafka's default rebalance protocol (`eager`) revokes all partitions from all consumers during rebalance. The `cooperative-sticky` protocol only revokes the partitions that need to move, keeping unaffected partitions actively processing:

```properties
camel.component.kafka.additional-properties[partition.assignment.strategy]=\
  org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

This reduces rebalance impact from "all consumers paused" to "only affected partitions paused."

## Tuning profiles for the shipping domain

| Consumer | Profile | Key settings |
|----------|---------|-------------|
| Order intake (REST → Kafka) | Low latency | `fetch.min.bytes=1`, `max.poll.records=100` |
| Inventory check | Balanced | Defaults, `autoCommitEnable=false` |
| Payment processing | Safety-first | `autoCommitEnable=false`, `allowManualCommit=true`, `isolation.level=read_committed` |
| Nightly batch export | High throughput | `fetch.min.bytes=65536`, `max.poll.records=1000`, `fetch.max.wait.ms=2000` |
| Monitoring dashboard | Tail only | `auto.offset.reset=latest`, `autoCommitEnable=true` |

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Camel Kafka component supports `fetchMinBytes`, `fetchWaitMaxMs`, `maxPollRecords`, `maxPollIntervalMs`, `autoCommitEnable`, `allowManualCommit`, `sessionTimeoutMs`, `heartbeatIntervalMs`, `autoOffsetReset`, `groupInstanceId` properties; `KafkaConstants.MANUAL_COMMIT` header is available for manual offset commit; cooperative-sticky assignor works via `additional-properties`.*
