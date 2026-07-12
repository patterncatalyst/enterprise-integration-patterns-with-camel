---
title: "Appendix O: Kafka Producer Tuning"
order: 33
part: appendices
description: "Batching, compression, acknowledgments, idempotence, and retry strategies for Camel Kafka producers."
duration: "20 minutes"
---

Appendix N covered the consumer side — fetch sizes, poll intervals, and offset commits. This appendix covers the producer: how Camel's Kafka component batches, compresses, and delivers messages, and which configuration properties control the tradeoffs between throughput, latency, and durability.

The code is in `examples/33-kafka-producer-tuning/`. The `README.md` there covers how to run it.

## The producer pipeline

A Kafka producer doesn't send each message individually. Messages pass through a pipeline of buffering, batching, and (optionally) compression before they reach the network:

{% include excalidraw.html file="33-producer-pipeline" alt="Kafka producer pipeline showing buffering, batching, compression, and broker acknowledgment" caption="Figure O.1 — The producer pipeline: records are buffered in the RecordAccumulator, batched by partition, optionally compressed, then sent to the broker. The broker acknowledgment flows back through a callback to the application." %}

## Acknowledgment guarantees — acks

The `acks` property controls how many replicas must acknowledge a write before the producer considers it successful:

| Value | Guarantee | Latency | Use case |
|-------|-----------|---------|----------|
| `0` | None — fire and forget | Lowest | Metrics, clickstream, logs |
| `1` | Leader only | Low | General messaging where occasional loss is tolerable |
| `all` (`-1`) | All in-sync replicas | Highest | Orders, payments — data cannot be lost |

```properties
# application.properties — safe defaults for shipping domain
camel.component.kafka.configuration.request-required-acks=all
```

With `acks=all`, combine with the broker's `min.insync.replicas` setting. If `min.insync.replicas=2` and one replica is down, writes still succeed (2 of 3 replicas available). If two replicas are down, writes fail — the producer receives `NotEnoughReplicasException`.

In Camel:

```java
from("direct:publish-order")
    .routeId("durable-producer")
    .marshal().json()
    .to("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&requestRequiredAcks=all");
```

## Batching — batch.size and linger.ms

Batching amortizes the overhead of network requests and broker writes across multiple records.

### batch.size

Maximum size in bytes for a batch destined for a single partition. Default: 16384 (16 KB).

```properties
camel.component.kafka.configuration.batch-size=32768
```

The producer accumulates records for each partition until the batch reaches `batch.size` bytes, then sends it. Larger batches reduce the number of requests but increase memory usage and latency for the last records in the batch.

### linger.ms

How long the producer waits for additional records before sending a batch. Default: 0 (send immediately).

```properties
camel.component.kafka.configuration.linger-ms=20
```

| Setting | Behavior |
|---------|----------|
| `0` (default) | Send batches immediately — lowest latency, most network requests |
| `5–20` | Small delay — batches fill more completely, fewer requests |
| `50–100` | Noticeable delay — best throughput for high-volume topics |

`linger.ms` and `batch.size` interact as a "first wins" pair: the batch is sent when either the batch is full or the linger time expires.

For the shipping domain: set `linger.ms=5` for the order intake producer (low latency) and `linger.ms=50` for the analytics event producer (high throughput):

```java
from("direct:order-analytics")
    .routeId("batched-analytics-producer")
    .marshal().json()
    .to("kafka:eip.analytics.events"
        + "?brokers={{kafka.brokers}}"
        + "&lingerMs=50"
        + "&batchSize=65536");
```

## Compression

Compressing batches reduces network bandwidth and broker storage at the cost of CPU. The producer compresses entire batches (not individual records), so larger batches compress more efficiently.

| Type | Compression ratio | CPU cost | Best for |
|------|-------------------|----------|----------|
| `none` (default) | 1:1 | None | Low-volume, CPU-constrained |
| `lz4` | ~2:1 | Very low | General purpose — best balance |
| `snappy` | ~2:1 | Low | Similar to LZ4, slightly different tradeoffs |
| `gzip` | ~3:1 | High | Maximum compression, batch/archival workloads |
| `zstd` | ~3:1 | Medium | Best ratio per CPU cycle |

```properties
camel.component.kafka.configuration.compression-codec=lz4
```

For JSON messages in the shipping domain (order events, inventory updates), `lz4` typically achieves 2–3x compression with negligible CPU overhead. This is almost always worth enabling:

```java
from("direct:publish-order")
    .routeId("compressed-producer")
    .marshal().json()
    .to("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&requestRequiredAcks=all"
        + "&compressionCodec=lz4");
```

## Buffer management

### buffer.memory

Total bytes the producer can use for buffering records waiting to be sent. Default: 33554432 (32 MB).

When the buffer is full, `send()` calls block for up to `max.block.ms` (default 60 seconds) before throwing `BufferExhaustedException`.

```properties
camel.component.kafka.configuration.buffer-memory-size=67108864
```

### max.block.ms

Maximum time `send()` blocks when the buffer is full or metadata is unavailable. Default: 60000 (60 seconds).

```properties
camel.component.kafka.additional-properties[max.block.ms]=30000
```

If the producer consistently fills its buffer, the bottleneck is downstream (broker throughput, network bandwidth). Increasing `buffer.memory` provides more headroom for bursts; increasing `max.block.ms` gives slower consumers more time to drain.

## Retries and delivery semantics

### retries and delivery.timeout.ms

The producer automatically retries failed sends. The two key properties:

| Property | Default | Controls |
|----------|---------|----------|
| `retries` | 2147483647 (max int) | Maximum retry attempts |
| `delivery.timeout.ms` | 120000 (2 min) | Total time for send + retries |

The effective retry behavior is bounded by `delivery.timeout.ms` — the producer gives up when the total time (including the initial attempt and all retries) exceeds this value, regardless of the `retries` count.

```properties
camel.component.kafka.configuration.retries=3
camel.component.kafka.additional-properties[delivery.timeout.ms]=30000
```

### Ordering and retries — max.in.flight.requests.per.connection

With `retries > 0` and `max.in.flight.requests.per.connection > 1`, message ordering can be violated: if batch 1 fails and batch 2 succeeds, batch 1's retry arrives after batch 2.

To preserve ordering:

```properties
# Option 1: limit in-flight to 1 (lowest throughput)
camel.component.kafka.additional-properties[max.in.flight.requests.per.connection]=1

# Option 2: enable idempotence (allows up to 5 in-flight, preserves order)
camel.component.kafka.additional-properties[enable.idempotence]=true
```

## Idempotent producer

Enabling idempotence eliminates duplicate messages caused by retries. The broker assigns each producer a PID (producer ID) and sequence numbers, and deduplicates by (PID, partition, sequence):

```properties
camel.component.kafka.additional-properties[enable.idempotence]=true
camel.component.kafka.configuration.request-required-acks=all
```

Idempotence requires `acks=all` and `max.in.flight.requests.per.connection <= 5`. When enabled, the producer can safely retry without creating duplicates and without sacrificing ordering — the best of both worlds for most workloads.

For the shipping domain, **enable idempotence on every producer** unless you have a specific reason not to:

```java
from("direct:publish-order")
    .routeId("idempotent-producer")
    .marshal().json()
    .to("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&requestRequiredAcks=all"
        + "&additionalProperties.enable.idempotence=true");
```

## Tuning profiles for the shipping domain

| Producer | Profile | Key settings |
|----------|---------|-------------|
| Order intake (REST → Kafka) | Low latency, safe | `acks=all`, `linger.ms=0`, `enable.idempotence=true` |
| Inventory events | Balanced | `acks=all`, `linger.ms=5`, `batch.size=32768`, `compression=lz4` |
| Analytics / metrics | High throughput | `acks=1`, `linger.ms=50`, `batch.size=65536`, `compression=lz4` |
| Audit log | Durability | `acks=all`, `enable.idempotence=true`, `compression=zstd` |

## Common pitfalls

**Buffer exhaustion under load**: if your producer's `buffer.memory` is too small for burst traffic, `send()` blocks and the Camel route backs up. Monitor `buffer-available-bytes` and `buffer-exhausted-rate` JMX metrics.

**Compression with small batches**: compressing a 100-byte batch wastes CPU and may increase the payload size. Compression pays off when batches are at least a few KB — increase `batch.size` and `linger.ms` alongside `compression.type`.

**Ignoring delivery failures**: by default, Camel's Kafka producer logs failures but doesn't throw exceptions back to the route. Use `synchronous=true` in the Kafka endpoint URI to make the route wait for broker acknowledgment and handle failures via Camel's error handler:

```java
from("direct:publish-order")
    .routeId("sync-producer")
    .marshal().json()
    .to("kafka:eip.orders.placed"
        + "?brokers={{kafka.brokers}}"
        + "&synchronous=true"
        + "&requestRequiredAcks=all");
```

---

*Verification status: <span class="status status--verified">verified</span> on Quarkus 3.37 / Camel 4.20 / Java 25.
Example `33-kafka-producer-tuning` compiles and runs against the Podman stack with Kafka (KRaft).*
