---
title: "Appendix Q: Kafka Diagnostics"
order: 35
part: appendices
description: "Collecting broker logs, consumer group state, topic metadata, JMX metrics, and thread dumps for Kafka troubleshooting."
duration: "20 minutes"
---

When a Kafka-backed integration route stalls — consumer lag climbs, messages disappear, or throughput drops — you need a systematic approach to collecting diagnostic data. This appendix covers the tools and commands for gathering the information you need to diagnose Kafka issues, from the local Podman stack through production Kubernetes deployments.

## Diagnostic data categories

Kafka diagnostics fall into five categories, each answering different questions:

| Category | What it tells you | Key tools |
|----------|-------------------|-----------|
| **Broker logs** | Errors, warnings, rebalance events, slow requests | Container logs, log4j |
| **Topic metadata** | Partition layout, replication status, config overrides | `kafka-topics.sh` |
| **Consumer group state** | Lag, assignment, coordinator, member status | `kafka-consumer-groups.sh` |
| **JMX metrics** | Request latency, throughput, ISR counts, buffer usage | JMX exporter, Kafka UI |
| **JVM diagnostics** | Thread dumps, heap dumps, GC logs | `jcmd`, `jstack`, JFR |

## Broker logs

### Local Podman stack

```bash
# Stream broker logs (follow mode)
podman logs -f eip-kafka

# Last 200 lines
podman logs --tail 200 eip-kafka

# Grep for specific errors
podman logs eip-kafka 2>&1 | grep -i "error\|exception\|warn"
```

### What to look for

| Log pattern | Indicates |
|-------------|-----------|
| `LEADER_NOT_AVAILABLE` | Partition leader election in progress — transient during startup |
| `NOT_ENOUGH_REPLICAS` | Too few in-sync replicas for `acks=all` writes |
| `REBALANCE` / `JoinGroup` | Consumer group rebalancing — check frequency and duration |
| `RequestTimedOut` | Broker unable to handle requests within timeout — check load |
| `OutOfMemoryError` | JVM heap exhaustion — increase broker memory or reduce load |
| `CorruptRecordException` | Data corruption — investigate disk health |

### Adjusting broker log level

For the Podman stack, set the `KAFKA_LOG4J_ROOT_LOGLEVEL` environment variable:

```yaml
# compose.yaml
environment:
  - KAFKA_LOG4J_ROOT_LOGLEVEL=INFO
  - KAFKA_LOG4J_LOGGERS=kafka.controller=DEBUG,kafka.server=DEBUG
```

For specific debugging scenarios:
- **Rebalance issues**: `kafka.coordinator.group=DEBUG`
- **Replication**: `kafka.server.ReplicaManager=DEBUG`
- **Request handling**: `kafka.network.RequestChannel=DEBUG`

## Topic metadata

### List topics and their configuration

```bash
# List all topics
podman exec eip-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Describe a specific topic (partitions, replicas, ISR)
podman exec eip-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --describe --topic eip.orders.placed
```

Output shows partition layout, leader assignment, and in-sync replica status:

```
Topic: eip.orders.placed  PartitionCount: 3  ReplicationFactor: 1
  Partition: 0  Leader: 1  Replicas: 1  Isr: 1
  Partition: 1  Leader: 1  Replicas: 1  Isr: 1
  Partition: 2  Leader: 1  Replicas: 1  Isr: 1
```

**Red flags**: `Isr` count less than `Replicas` count means replicas are out of sync. `Leader: -1` means no leader is elected for that partition.

### Check topic-level configuration overrides

```bash
podman exec eip-kafka /opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name eip.orders.placed \
  --describe
```

### Check disk usage per topic

```bash
podman exec eip-kafka /opt/kafka/bin/kafka-log-dirs.sh \
  --bootstrap-server localhost:9092 \
  --describe --topic-list eip.orders.placed
```

This shows the size of each partition's log segments on disk — essential for capacity planning and identifying topics that are growing faster than expected.

## Consumer group diagnostics

Consumer group state is usually the first thing to check when messages are "stuck."

### List consumer groups

```bash
podman exec eip-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --list
```

### Describe a consumer group (lag, assignment)

```bash
podman exec eip-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group inventory-service
```

Output:

```
GROUP             TOPIC              PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG    CONSUMER-ID                HOST         CLIENT-ID
inventory-service eip.orders.placed  0          1042            1050            8      consumer-1-abc-xyz         /10.89.0.5   consumer-1
inventory-service eip.orders.placed  1          987             987             0      consumer-1-abc-xyz         /10.89.0.5   consumer-1
inventory-service eip.orders.placed  2          1103            1200            97     consumer-2-def-uvw         /10.89.0.6   consumer-2
```

**What each column means**:
- **CURRENT-OFFSET**: last committed offset for this (group, partition)
- **LOG-END-OFFSET**: latest message offset in the partition
- **LAG**: `LOG-END-OFFSET - CURRENT-OFFSET` — messages not yet committed
- **CONSUMER-ID**: which consumer instance owns this partition
- **HOST**: consumer's IP address

**Diagnostic patterns**:

| Observation | Likely cause |
|-------------|-------------|
| High lag, consumer assigned | Consumer is slow — check processing time, downstream dependencies |
| High lag, no consumer assigned | Consumer crashed or was evicted — check consumer logs |
| All partitions assigned to one consumer | Other consumers failed to join — check connectivity, group coordinator |
| Lag growing steadily | Production rate exceeds consumption rate — add consumers or optimize processing |
| Lag spikes then recovers | Burst traffic or brief consumer pause (GC, rebalance) |

### Check consumer group state

```bash
podman exec eip-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group inventory-service --state
```

Output:

```
GROUP             COORDINATOR (ID)   ASSIGNMENT-STRATEGY  STATE      #MEMBERS
inventory-service kafka:9092 (1)     range                Stable     2
```

States: `Stable` (normal), `PreparingRebalance` (rebalancing in progress), `CompletingRebalance` (almost done), `Empty` (no active consumers), `Dead` (group metadata expired).

### Reset consumer group offsets

When you need to reprocess messages (after a bug fix, for example):

```bash
# Dry run first — see what would change
podman exec eip-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group inventory-service \
  --topic eip.orders.placed \
  --reset-offsets --to-earliest --dry-run

# Execute the reset (group must have no active consumers)
podman exec eip-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group inventory-service \
  --topic eip.orders.placed \
  --reset-offsets --to-earliest --execute
```

Other reset targets: `--to-latest`, `--to-offset <n>`, `--to-datetime <ISO-8601>`, `--shift-by <n>`.

## JMX metrics

Kafka exposes hundreds of metrics via JMX. For integration route debugging, focus on these:

### Broker-side metrics

| Metric | What it tells you |
|--------|-------------------|
| `kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec` | Ingestion rate — is the broker keeping up? |
| `kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec` | Byte-level ingestion rate |
| `kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions` | Replicas falling behind — disk or network issue |
| `kafka.server:type=ReplicaManager,name=IsrShrinksPerSec` | ISR shrink rate — replicas going out of sync |
| `kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce` | Produce request latency — broker overload indicator |
| `kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Fetch` | Fetch request latency |

### Client-side metrics (Camel/Kafka producer)

| Metric | What it tells you |
|--------|-------------------|
| `kafka.producer:type=producer-metrics,client-id=*,record-send-rate` | Records sent per second |
| `kafka.producer:type=producer-metrics,client-id=*,record-error-rate` | Failed sends per second |
| `kafka.producer:type=producer-metrics,client-id=*,buffer-available-bytes` | Remaining buffer space |
| `kafka.producer:type=producer-metrics,client-id=*,request-latency-avg` | Average round-trip time |

### Exposing JMX metrics in the Podman stack

```yaml
# compose.yaml — add JMX exporter to Kafka
environment:
  - KAFKA_JMX_OPTS=-Dcom.sun.management.jmxremote
    -Dcom.sun.management.jmxremote.port=9999
    -Dcom.sun.management.jmxremote.rmi.port=9999
    -Dcom.sun.management.jmxremote.authenticate=false
    -Dcom.sun.management.jmxremote.ssl=false
ports:
  - "9999:9999"
```

Our Kafka UI at `http://localhost:8090` surfaces many of these metrics in a friendlier format — check the broker and topic dashboards first before diving into raw JMX.

## JVM diagnostics

When Kafka issues are JVM-related (GC pauses, thread contention, memory pressure):

### Thread dump

```bash
# Get the JVM PID inside the container
podman exec eip-kafka bash -c 'jcmd 1 Thread.print'
```

Look for:
- Threads stuck in `BLOCKED` state — contention on a lock
- Many threads in `WAITING` on the same monitor — resource starvation
- `GC` threads consuming excessive CPU

### Heap dump

```bash
# Trigger a heap dump (large file — ensure disk space)
podman exec eip-kafka bash -c 'jcmd 1 GC.heap_dump /tmp/kafka-heap.hprof'

# Copy it out of the container
podman cp eip-kafka:/tmp/kafka-heap.hprof ./kafka-heap.hprof
```

Analyze with Eclipse MAT, VisualVM, or `jhat` to find memory leaks.

### GC logging

Add GC logging to the broker's JVM options:

```yaml
environment:
  - KAFKA_OPTS=-Xlog:gc*:file=/var/log/kafka/gc.log:time,tags:filecount=5,filesize=20M
```

## A diagnostic workflow

When something goes wrong, work through this checklist:

1. **Check consumer group lag** — is the consumer falling behind? (`kafka-consumer-groups.sh --describe`)
2. **Check consumer group state** — is the group stable or rebalancing? (`--state`)
3. **Check broker logs** — any errors, warnings, or rebalance entries? (`podman logs`)
4. **Check topic metadata** — are all partitions healthy with leaders and ISR? (`kafka-topics.sh --describe`)
5. **Check Camel route logs** — is the route processing messages or stuck?
6. **Check JMX metrics** — request latency, under-replicated partitions, buffer usage
7. **Thread dump** — if the JVM appears hung, capture thread state

Most Kafka issues in integration routes fall into three categories: **consumer lag** (consumer too slow), **rebalance storms** (consumers joining/leaving frequently), and **producer failures** (broker unavailable, buffer exhaustion). The diagnostic workflow above covers all three.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `kafka-topics.sh`, `kafka-consumer-groups.sh`, `kafka-log-dirs.sh`, and `kafka-configs.sh` are available in the Apache Kafka container image; `--describe`, `--state`, `--reset-offsets` flags work as documented; `jcmd` is available inside the Kafka container for JVM diagnostics; JMX configuration environment variables are correct.*
