#!/usr/bin/env bash
# Appendix P — Kafka Share Groups (KIP-932), demonstrated end to end.
#
# There is no Camel code here on purpose. As of Camel 4.22 the Kafka component
# has no share-group support: no groupType option, no share consumer. Share
# groups are a broker-and-client feature, so this drives them with the tools
# Kafka 4.x ships rather than pretending Camel can do it.
#
#   ./share-groups-demo.sh
#
# Requires the base stack (./scripts/setup-stack.sh). The broker needs two
# settings that are NOT defaults -- compose.yaml sets both, see the README.

set -uo pipefail

RUN="$$"
BS="localhost:9092"
K="docker exec eip-kafka /opt/kafka/bin"

say()  { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
note() { printf '   \033[2m%s\033[0m\n' "$1"; }

# Each scenario gets its own topic. Share groups here start from the beginning,
# so a shared topic would hand back earlier scenarios' messages and make the
# output impossible to follow.
make_topic() {                    # make_topic <name> <partitions>
  $K/kafka-topics.sh --bootstrap-server "$BS" --create --if-not-exists \
    --topic "$1" --partitions "$2" --replication-factor 1 >/dev/null 2>&1
}

drop_topic() {
  $K/kafka-topics.sh --bootstrap-server "$BS" --delete --topic "$1" >/dev/null 2>&1
}

produce() {                       # produce <topic> <prefix> <count>
  local topic="$1" prefix="$2" n="$3"
  for i in $(seq 1 "$n"); do echo "{\"order_id\":\"$prefix-$i\",\"amount\":$((i * 50))}"; done \
    | docker exec -i eip-kafka /opt/kafka/bin/kafka-console-producer.sh \
        --bootstrap-server "$BS" --topic "$topic" >/dev/null 2>&1
}

new_group() {                     # new_group <group> -- read from the beginning
  $K/kafka-configs.sh --bootstrap-server "$BS" --entity-type groups \
    --entity-name "$1" --alter --add-config share.auto.offset.reset=earliest >/dev/null 2>&1
}

consume() {                       # consume <topic> <group> <count> [--release|--reject]
  local topic="$1" group="$2" count="$3"; shift 3
  timeout 120 docker exec eip-kafka /opt/kafka/bin/kafka-console-share-consumer.sh \
    --bootstrap-server "$BS" --topic "$topic" --group "$group" \
    --max-messages "$count" --timeout-ms 30000 "$@" 2>/dev/null \
    | grep -oE '"order_id":"[A-Z]+-[0-9]+"' | sed 's/.*:"//; s/"//' | sort -V | tr '\n' ' '
  echo
}

# ─────────────────────────────────────────────────────────────────────────────
say "1. More consumers than partitions"
note "A consumer group caps useful parallelism at the partition count: with 3"
note "partitions a fourth consumer sits idle. A share group has no such limit."
T="eip.share.fanout.$RUN"; G="fanout-$RUN"
make_topic "$T" 3; new_group "$G"
produce "$T" FAN 9
echo -n "   worker 1 took: "; consume "$T" "$G" 3
echo -n "   worker 2 took: "; consume "$T" "$G" 3
echo -n "   worker 3 took: "; consume "$T" "$G" 3
note "Nine orders, three workers, no worker owned a partition."
drop_topic "$T"

# ─────────────────────────────────────────────────────────────────────────────
say "2. ACCEPT — processed, never coming back"
T="eip.share.accept.$RUN"; G="accept-$RUN"
make_topic "$T" 1; new_group "$G"
produce "$T" ACC 4
echo -n "   first pass:  "; consume "$T" "$G" 4
echo -n "   second pass: "; consume "$T" "$G" 4
note "Second pass is empty: accepted messages are done."
drop_topic "$T"

# ─────────────────────────────────────────────────────────────────────────────
say "3. RELEASE — put it back for someone else"
note "The consumer cannot handle it *right now* -- a downstream service is down."
T="eip.share.release.$RUN"; G="release-$RUN"
make_topic "$T" 1; new_group "$G"
produce "$T" REL 4
echo -n "   first pass with --release: "; consume "$T" "$G" 4 --release
echo -n "   second pass:               "; consume "$T" "$G" 4
note "The same orders come back. This is the retry that consumer groups make you build."
drop_topic "$T"

# ─────────────────────────────────────────────────────────────────────────────
say "4. REJECT — poison message, do not redeliver"
note "The message is bad and will never succeed. Redelivering it wastes everyone's time."
T="eip.share.reject.$RUN"; G="reject-$RUN"
make_topic "$T" 1; new_group "$G"
produce "$T" REJ 4
echo -n "   first pass with --reject: "; consume "$T" "$G" 4 --reject
echo -n "   second pass:              "; consume "$T" "$G" 4
note "Second pass is empty: rejected messages are gone, like accepted ones."
drop_topic "$T"

# ─────────────────────────────────────────────────────────────────────────────
say "5. Inspecting share groups"
$K/kafka-share-groups.sh --bootstrap-server "$BS" --list 2>/dev/null \
  | grep -- "-$RUN\$" | sed 's/^/   /'

say "Done"
note "Share group state persists after the topics are deleted."
note "Clean up with: kafka-share-groups.sh --bootstrap-server $BS --delete --group <name>"
