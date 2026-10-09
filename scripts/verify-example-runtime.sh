#!/usr/bin/env bash
# Start a built example, drive it, and report whether its routes actually
# processed messages.
#
# The Citrus tests cover most examples. This is for the ones that ship no tests,
# where "it builds" was previously the only evidence anyone had.
#
#   ./scripts/verify-example-runtime.sh <example> <runtime> [seconds] [curl-url] [curl-data]
#
# Requires the base stack to be up (./scripts/setup-stack.sh) and the Citrus
# tests NOT to be running: they contend for the same host ports.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

EXAMPLE="${1:?example directory name}"
RUNTIME="${2:?quarkus or spring-boot}"
WAIT="${3:-35}"
URL="${4:-}"
DATA="${5:-}"

DIR="examples/$EXAMPLE/$RUNTIME"
LOG="${TMPDIR:-/tmp}/verify-${EXAMPLE}-${RUNTIME}.log"

if [ "$RUNTIME" = "quarkus" ]; then
  JAR="$DIR/target/quarkus-app/quarkus-run.jar"
else
  JAR="$(ls "$DIR"/target/*.jar 2>/dev/null | grep -v -- '-sources\|-plain' | head -1)"
fi
[ -f "$JAR" ] || { echo "  no built jar for $EXAMPLE/$RUNTIME — run the build first"; exit 2; }

java -jar "$JAR" > "$LOG" 2>&1 &
PID=$!
trap 'kill -TERM $PID 2>/dev/null; wait $PID 2>/dev/null' EXIT

# Wait for startup.
for _ in $(seq 1 "$WAIT"); do
  grep -qE 'started in|Started .*Application|Apache Camel .* started' "$LOG" && break
  kill -0 $PID 2>/dev/null || { echo "  process died during startup"; tail -15 "$LOG"; exit 1; }
  sleep 1
done

# Drive it, if it needs driving.
if [ -n "$URL" ]; then
  sleep 3
  code=$(curl -s -o /tmp/verify-resp.txt -w '%{http_code}' --max-time 20 \
         -X POST "$URL" -H 'Content-Type: application/json' -d "$DATA")
  echo "  POST $URL -> HTTP $code  $(head -c 120 /tmp/verify-resp.txt)"
fi

# Consumer-only examples need fresh records: the other runtime shares the
# consumer group and has already committed whatever was on the topic.
#   SEED_TOPIC=eip.orders.placed SEED='{"order_id":"DSL-1","amount":640.00}' ./scripts/verify-example-runtime.sh ...
if [ -n "${SEED_TOPIC:-}" ] && [ -n "${SEED:-}" ]; then
  sleep 5   # let the consumer join its group
  printf '%s\n' "$SEED" | docker exec -i eip-kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 --topic "$SEED_TOPIC" \
    && echo "  seeded $(printf '%s\n' "$SEED" | grep -c .) record(s) on $SEED_TOPIC"
fi

# Let timer-driven routes turn over.
sleep 12

# A Spring Boot app with no web starter and no camel.main.run-controller
# starts, logs "Started", and then exits on its own. Catch that here.
if ! kill -0 $PID 2>/dev/null; then
  trap - EXIT
  echo "  RESULT: process exited on its own after startup (nothing keeps the JVM alive)"
  exit 1
fi

kill -TERM $PID 2>/dev/null
wait $PID 2>/dev/null
trap - EXIT

routes=$(grep -cE 'Routes startup|routes started' "$LOG")
# Count log lines whose logger is a route id rather than a framework class.
# Spring Boot renders these as "... route-id  : message"; Quarkus as
# "INFO  [route-id] (thread) message". Match both.
activity=$(grep -cE '\] +[a-z][a-z0-9-]+ +: |INFO +\[[a-z][a-z0-9-]+\] +\(' "$LOG")
errors=$(grep -cE 'ERROR|Exception(?!Handler)' "$LOG")

echo "  startup-lines=$routes  app-log-lines=$activity  error-lines=$errors"
echo "  log: $LOG"
[ "$activity" -gt 0 ] && echo "  RESULT: routes processed messages" || echo "  RESULT: NO route activity observed"
