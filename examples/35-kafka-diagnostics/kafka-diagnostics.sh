#!/usr/bin/env bash
# Appendix Q — the diagnostic workflow, automated.
#
# This is the checklist at the end of the chapter, run in order against the
# local stack. There is no Camel code because none of this is route logic: it
# is what you do at 3am when a route has stopped moving messages and you need
# to know whether the problem is the consumer, the broker, or the JVM.
#
#   ./kafka-diagnostics.sh                  # whole workflow
#   ./kafka-diagnostics.sh --group my-group # focus on one consumer group
#   ./kafka-diagnostics.sh --dump <pid>     # thread and heap dump for a JVM
#
# Requires the base stack (./scripts/setup-stack.sh).

set -uo pipefail

BS="localhost:9092"
K="docker exec eip-kafka /opt/kafka/bin"
GROUP=""
DUMP_PID=""
LAG_WARN=1000

while [ $# -gt 0 ]; do
  case "$1" in
    --group) GROUP="${2:-}"; shift 2 ;;
    --dump)  DUMP_PID="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

step()  { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
ok()    { printf '   \033[32m%s\033[0m\n' "$1"; }
warn()  { printf '   \033[33m%s\033[0m\n' "$1"; }
bad()   { printf '   \033[31m%s\033[0m\n' "$1"; }
note()  { printf '   \033[2m%s\033[0m\n' "$1"; }

if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^eip-kafka$'; then
  bad "eip-kafka is not running. Start it with ./scripts/setup-stack.sh"
  exit 1
fi

# ── JVM dumps, if that is all you asked for ──────────────────────────────────
if [ -n "$DUMP_PID" ]; then
  step "JVM diagnostics for PID $DUMP_PID"
  OUT="${TMPDIR:-/tmp}/kafka-diag-$DUMP_PID"
  mkdir -p "$OUT"
  if command -v jcmd >/dev/null 2>&1; then
    jcmd "$DUMP_PID" Thread.print > "$OUT/threads.txt" 2>&1 \
      && ok "thread dump  -> $OUT/threads.txt" || bad "thread dump failed"
    jcmd "$DUMP_PID" GC.heap_info > "$OUT/heap-info.txt" 2>&1 \
      && ok "heap summary -> $OUT/heap-info.txt" || bad "heap info failed"
    # A full heap dump is large and pauses the JVM. Ask before taking one.
    note "For a full heap dump (large, pauses the JVM):"
    note "  jcmd $DUMP_PID GC.heap_dump $OUT/heap.hprof"
    note "Deadlocked threads, if any:"
    grep -c 'Found one Java-level deadlock' "$OUT/threads.txt" 2>/dev/null \
      | sed 's/^/     deadlocks: /'
  else
    bad "jcmd not on PATH -- it ships with the JDK"
  fi
  exit 0
fi

# ── 1. Consumer group lag ────────────────────────────────────────────────────
step "1. Consumer group lag"
# Not named GROUPS: that is a bash built-in array of the current user's group
# IDs, so assigning to it and reading $GROUPS back gives you your own GID
# instead of anything Kafka said. Costs an hour if you do not know it.
# Keep only plausible group ids, in case the tool writes a warning to stdout.
GROUP_LIST=$($K/kafka-consumer-groups.sh --bootstrap-server "$BS" --list 2>/dev/null \
         | tr -d '\r' | grep -E '^[A-Za-z][A-Za-z0-9._-]*$')
if [ -z "$GROUP_LIST" ]; then
  note "No consumer groups. Nothing is consuming -- start an example first."
else
  [ -n "$GROUP" ] && GROUP_LIST="$GROUP"
  for g in $GROUP_LIST; do
    OUT=$($K/kafka-consumer-groups.sh --bootstrap-server "$BS" --describe --group "$g" 2>/dev/null)
    TOTAL=$(echo "$OUT" | awk 'NR>1 && $6 ~ /^[0-9]+$/ {s+=$6} END {print s+0}')
    if [ "$TOTAL" -ge "$LAG_WARN" ]; then
      warn "$(printf '%-34s lag %s' "$g" "$TOTAL")"
    else
      ok   "$(printf '%-34s lag %s' "$g" "$TOTAL")"
    fi
  done
  note "Lag climbing steadily means the consumer cannot keep up. Lag that is"
  note "large but flat usually means it stopped entirely -- check step 2."
fi

# ── 2. Consumer group state ──────────────────────────────────────────────────
step "2. Consumer group state"
if [ -n "${GROUP_LIST:-}" ]; then
  for g in $GROUP_LIST; do
    # Find the header by content, not by line number: the tool prints a blank
    # line first, and "COORDINATOR (ID)" splits into two fields, so neither
    # NR==1 nor counting back from NF is reliable.
    STATE=$($K/kafka-consumer-groups.sh --bootstrap-server "$BS" --describe --group "$g" --state 2>/dev/null \
            | awk '!c && /GROUP/ && /STATE/ {for (i=1;i<=NF;i++) if ($i=="STATE") c=i; next}
                   c && NF>=c {print $c; exit}')
    case "$STATE" in
      Stable)               ok   "$(printf '%-34s %s' "$g" "$STATE")" ;;
      Empty|Dead)           warn "$(printf '%-34s %s  (no members)' "$g" "$STATE")" ;;
      PreparingRebalance|CompletingRebalance)
                            warn "$(printf '%-34s %s' "$g" "$STATE")" ;;
      *)                    note "$(printf '%-34s %s' "$g" "${STATE:-unknown}")" ;;
    esac
  done
  note "A group stuck rebalancing is the classic rebalance storm: a consumer"
  note "exceeding max.poll.interval.ms, getting evicted, rejoining, repeat."
fi

# ── 3. Broker logs ───────────────────────────────────────────────────────────
step "3. Broker logs (errors and rebalances, last 500 lines)"
LOGS=$(docker logs --tail 500 eip-kafka 2>&1)
ERRS=$(echo "$LOGS" | grep -cE '\bERROR\b')
WARNS=$(echo "$LOGS" | grep -cE '\bWARN\b')
REBAL=$(echo "$LOGS" | grep -ciE 'rebalanc')
[ "$ERRS" -gt 0 ] && bad "ERROR lines: $ERRS" || ok "ERROR lines: 0"
[ "$WARNS" -gt 0 ] && warn "WARN lines:  $WARNS" || ok "WARN lines:  0"
note "rebalance mentions: $REBAL"
[ "$ERRS" -gt 0 ] && echo "$LOGS" | grep -E '\bERROR\b' | tail -3 | sed 's/^/     /'

# ── 4. Topic health ──────────────────────────────────────────────────────────
step "4. Topic health (leaders and ISR)"
UNDER=$($K/kafka-topics.sh --bootstrap-server "$BS" --describe --under-replicated-partitions 2>/dev/null | grep -c 'Topic:')
NOLEAD=$($K/kafka-topics.sh --bootstrap-server "$BS" --describe --unavailable-partitions 2>/dev/null | grep -c 'Topic:')
COUNT=$($K/kafka-topics.sh --bootstrap-server "$BS" --list 2>/dev/null | grep -vc '^__')
ok   "topics (excluding internal): $COUNT"
[ "$UNDER"  -gt 0 ] && bad "under-replicated partitions: $UNDER"  || ok "under-replicated partitions: 0"
[ "$NOLEAD" -gt 0 ] && bad "partitions with no leader:   $NOLEAD" || ok "partitions with no leader:   0"
note "On this single-broker stack both should always be zero. Anything else"
note "means the broker is in trouble, not your route."

# ── 5. Camel route health ────────────────────────────────────────────────────
step "5. Camel routes"
FOUND=0
# Deliberately does not scan 8080 or 8081: those are Pulsar admin and Apicurio,
# which answer on /q/health-shaped paths with something that is not a Camel
# health document, and reporting them as unknown Camel apps is just noise.
for port in 8085 8086 8087 8088 8096 8097 8098; do
  H=$(curl -s -m 2 "http://localhost:$port/q/health" 2>/dev/null)
  [ -z "$H" ] && H=$(curl -s -m 2 "http://localhost:$port/actuator/health" 2>/dev/null)
  case "$H" in
    *'"status"'*)
      FOUND=1
      STATUS=$(echo "$H" | grep -oE '"status"[: ]+"[A-Z]+"' | head -1 | grep -oE '[A-Z]+$')
      case "$STATUS" in
        UP) ok   "port $port: UP" ;;
        *)  warn "port $port: ${STATUS:-DOWN}" ;;
      esac
      ;;
  esac
done
[ "$FOUND" -eq 0 ] && note "No Camel app exposing a health endpoint on the usual ports."

# ── 6. JMX metrics ───────────────────────────────────────────────────────────
step "6. JMX metrics"
if docker exec eip-kafka test -x /opt/kafka/bin/kafka-run-class.sh 2>/dev/null; then
  note "JMX is not exposed by default in this stack. To enable it, add to the"
  note "kafka service in compose.yaml:"
  note "  - KAFKA_JMX_PORT=9999"
  note "  - KAFKA_JMX_HOSTNAME=localhost"
  note "then read it with: jconsole localhost:9999, or kafka-run-class.sh"
  note "kafka.tools.JmxTool --object-name 'kafka.server:type=BrokerTopicMetrics,*'"
fi

# ── 7. JVM diagnostics ───────────────────────────────────────────────────────
step "7. JVM diagnostics"
# Container processes are visible as host processes, so a naive pgrep
# for quarkus-run.jar also matches Apicurio inside its container. Anything
# launched from /deployments is a container, not something you started.
CAMEL_PIDS=$(pgrep -af 'quarkus-run.jar|-springboot-.*\.jar' 2>/dev/null \
             | grep -v '/deployments/' | awk '{print $1}' | head -5)
if [ -n "$CAMEL_PIDS" ]; then
  for p in $CAMEL_PIDS; do
    ok "Camel JVM pid $p -- dump it with: $0 --dump $p"
  done
else
  note "No Camel application JVMs found."
fi
note "The Kafka broker runs inside the container; for its JVM use:"
note "  docker exec eip-kafka jcmd 1 Thread.print"

step "Done"
note "Most route problems are one of three things: consumer lag (too slow),"
note "rebalance storms (joining and leaving), or producer failures (broker"
note "unreachable, buffer full). Steps 1-3 tell you which."
