# 34 — Kafka Share Groups (Appendix P)

```bash
./scripts/setup-stack.sh
cd examples/34-kafka-share-groups && ./share-groups-demo.sh
```

## Why there is no Camel code here

**As of Camel 4.22 the Kafka component has no share-group support.** There is no
`groupType` endpoint option and no share consumer — checked against
`camel-kafka-4.22.0`. Share groups are a broker-and-client feature, and the
client side is `KafkaShareConsumer` in `kafka-clients`, which Camel does not
wrap yet.

So this example drives them with the tools Kafka 4.x ships —
`kafka-console-share-consumer.sh` and `kafka-share-groups.sh` — rather than
showing a Camel route that would not run. When Camel gains support, this is the
example to replace.

## What the script shows

1. **More consumers than partitions.** Nine orders on three partitions, split
   evenly across three workers. A consumer group caps useful parallelism at the
   partition count; a share group does not, which is the whole point.
2. **ACCEPT** — the default. Consumed once, never redelivered.
3. **RELEASE** — the consumer cannot handle it *right now*. The order goes back
   to the pool and the next pass picks it up again. This is the retry you
   otherwise build yourself.
4. **REJECT** — the message is bad and never will succeed. Gone, like an
   accepted one, without cycling forever.

Each scenario gets its own topic, because share groups here read from the
beginning and a shared topic would hand back the previous scenario's messages.

## Two broker settings you will not find by guessing

Share groups are off by default on a single-broker KRaft cluster in a way that
gives you no clue. `share.version` is finalized at level 1 out of the box, so
`kafka-features.sh describe` says the feature is enabled — and every share
consumer still times out with `TimeoutException` and zero messages.

`examples/_infra/compose.yaml` sets both of these:

```yaml
# 1. The share protocol is not in the coordinator's default protocol list.
- KAFKA_GROUP_COORDINATOR_REBALANCE_PROTOCOLS=classic,consumer,streams,share

# 2. The share coordinator's internal state topic defaults to replication
#    factor 3 and min ISR 2 -- neither satisfiable on one broker, so the
#    coordinator never becomes usable.
- KAFKA_SHARE_COORDINATOR_STATE_TOPIC_REPLICATION_FACTOR=1
- KAFKA_SHARE_COORDINATOR_STATE_TOPIC_MIN_ISR=1
```

The second is the same workaround the compose file already applies to the
offsets and transaction-state topics; the share coordinator just arrived later
and needs its own.

## Other things worth knowing

**`share.auto.offset.reset` is a group config, not a consumer property**, and it
only applies to a group that does not exist yet. Setting it on a group that has
already run does nothing:

```bash
kafka-configs.sh --bootstrap-server localhost:9092 --entity-type groups \
  --entity-name my-group --alter --add-config share.auto.offset.reset=earliest
```

**Share group state outlives the topic.** Deleting a topic leaves the groups
behind; `kafka-share-groups.sh --delete --group <name>` removes them.

## Verified

2026-09-16, against Kafka 4.3.1 in the compose stack. Nine orders split 3/3/3
across three workers on a three-partition topic; accepted and rejected messages
did not reappear on a second pass; released messages did.
