#!/usr/bin/env bash
# Run one of the JBang/YAML appendix examples through the Camel CLI, drive it,
# and report whether the routes processed anything.
#
# These three examples have no Maven project, so neither the build nor the test
# suite covers them; they were the only chapters never exercised by anything.
#
#   ./scripts/verify-jbang-example.sh <example-dir> <seconds> [url] [header] [json]
#
# Requires the base stack up.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

EX="${1:?example directory under examples/}"
SECS="${2:-60}"
URL="${3:-}"
HDR="${4:-}"
BODY="${5:-}"

DIR="examples/$EX"
LOG="${TMPDIR:-/tmp}/jbang-${EX//\//_}.log"
[ -d "$DIR" ] || { echo "no such example: $DIR"; exit 2; }

cd "$DIR" || exit 1
# shellcheck disable=SC2086
timeout $((SECS + 60)) camel run ./*.yaml --port=8088 --max-seconds="$SECS" > "$LOG" 2>&1 &
PID=$!
trap 'kill -TERM $PID 2>/dev/null; wait $PID 2>/dev/null' EXIT

for _ in $(seq 1 40); do
  grep -qE 'HTTP endpoints summary|Routes startup' "$LOG" && break
  kill -0 $PID 2>/dev/null || break
  sleep 2
done
sleep 4

if [ -n "$URL" ]; then
  code=$(curl -s -o /tmp/jbang-resp.txt -w '%{http_code}' --max-time 25 \
         -X POST "$URL" -H 'Content-Type: application/json' \
         ${HDR:+-H "$HDR"} -d "$BODY")
  echo "  POST $URL -> HTTP $code  $(head -c 140 /tmp/jbang-resp.txt)"
fi

# Consumer-only examples need fresh records (same option as
# verify-example-runtime.sh):
#   SEED_TOPIC=eip.orders.placed SEED='{"order_id":"DSL-1","amount":640.00}' ./scripts/verify-jbang-example.sh ...
if [ -n "${SEED_TOPIC:-}" ] && [ -n "${SEED:-}" ]; then
  sleep 5   # let the consumer join its group
  printf '%s\n' "$SEED" | docker exec -i eip-kafka /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 --topic "$SEED_TOPIC" \
    && echo "  seeded $(printf '%s\n' "$SEED" | grep -c .) record(s) on $SEED_TOPIC"
fi

sleep 14
kill -TERM $PID 2>/dev/null; wait $PID 2>/dev/null
trap - EXIT

routes=$(grep -oE 'Routes startup \(total:[0-9]+' "$LOG" | head -1)
errors=$(grep -cE 'ERROR|NoTypeConversion|BindException' "$LOG")
activity=$(grep -cE '\] [a-zA-Z0-9_.-]+\.yaml:[0-9]+ +: ' "$LOG")

echo "  $routes   app-log-lines=$activity   error-lines=$errors"
echo "  log: $LOG"
[ "$activity" -gt 0 ] && [ "$errors" -eq 0 ] && echo "  RESULT: routes ran clean" || echo "  RESULT: needs review"
