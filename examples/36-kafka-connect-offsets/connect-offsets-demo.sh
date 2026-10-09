#!/usr/bin/env bash
# Appendix R — managing Kafka Connect offsets through the REST API.
#
# Walks the full lifecycle on a real connector: read offsets, stop, alter with
# PATCH (KIP-875), restart and watch it reprocess, then reset with DELETE.
#
#   ./connect-offsets-demo.sh
#
# Requires the base stack plus the Connect worker:
#   ./scripts/setup-stack.sh
#   docker compose -p eip -f examples/_infra/compose.yaml \
#                  -f examples/36-kafka-connect-offsets/compose.connect.yaml up -d connect

set -uo pipefail

CONNECT="http://localhost:8083"
NAME="orders-source"
SRC="/tmp/connect-data/orders.txt"
TOPIC="eip.connect.orders"

step() { printf '\n\033[1m── %s ──\033[0m\n' "$1"; }
note() { printf '   \033[2m%s\033[0m\n' "$1"; }
jq_() { python3 -m json.tool 2>/dev/null || cat; }

# Connect takes 30-60 s to answer after `up -d`; wait rather than fail.
for _ in $(seq 1 60); do
  curl -sf -m 5 "$CONNECT/" >/dev/null 2>&1 && break
  sleep 2
done
if ! curl -sf -m 5 "$CONNECT/" >/dev/null 2>&1; then
  printf '\033[31m   Connect is not answering on %s\033[0m\n' "$CONNECT"
  note "Start it with:"
  note "  docker compose -p eip -f examples/_infra/compose.yaml \\"
  note "                 -f examples/36-kafka-connect-offsets/compose.connect.yaml up -d connect"
  exit 1
fi

wait_state() {                    # wait_state <connector> <STATE>
  for _ in $(seq 1 30); do
    curl -s -m 5 "$CONNECT/connectors/$1/status" 2>/dev/null \
      | grep -q "\"state\":\"$2\"" && return 0
    sleep 1
  done
  return 1
}

consumed() {                      # how many records reached the topic
  # kafka-get-offsets.sh, not kafka-run-class.sh kafka.tools.GetOffsetShell --
  # that class moved to org.apache.kafka.tools in Kafka 4.x, and the old
  # invocation fails with ClassNotFoundException.
  docker exec eip-kafka /opt/kafka/bin/kafka-get-offsets.sh \
    --bootstrap-server localhost:9092 --topic "$TOPIC" 2>/dev/null \
    | awk -F: '{s+=$3} END {print s+0}'
}

# ─────────────────────────────────────────────────────────────────────────────
step "Setup: a source file with 10 orders"
# Written straight into the container: see the note in compose.connect.yaml
# about relative volume paths.
ORDERS=""
for i in $(seq 1 10); do ORDERS="$ORDERS{\"order_id\":\"CN-$i\",\"amount\":$((i * 25))}
"; done
docker exec eip-connect mkdir -p /tmp/connect-data
printf '%s' "$ORDERS" | docker exec -i eip-connect sh -c "cat > $SRC"
note "wrote $(docker exec eip-connect sh -c "wc -l < $SRC" 2>/dev/null | tr -d ' ') lines to $SRC -> $TOPIC"

curl -s -X DELETE "$CONNECT/connectors/$NAME" >/dev/null 2>&1
docker exec eip-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 \
  --delete --topic "$TOPIC" >/dev/null 2>&1
sleep 3

step "1. Create the connector"
curl -s -X POST -H 'Content-Type: application/json' "$CONNECT/connectors" -d "{
  \"name\": \"$NAME\",
  \"config\": {
    \"connector.class\": \"org.apache.kafka.connect.file.FileStreamSourceConnector\",
    \"tasks.max\": \"1\",
    \"file\": \"$SRC\",
    \"topic\": \"$TOPIC\"
  }
}" | jq_ | head -12
wait_state "$NAME" RUNNING && note "connector is RUNNING" || note "connector did not reach RUNNING"
sleep 8
note "records in $TOPIC: $(consumed)"

step "2. Read the offsets  (GET /connectors/$NAME/offsets)"
curl -s -m 5 "$CONNECT/connectors/$NAME/offsets" | jq_
note "position is the byte offset the connector has read up to in the file."

step "3. Stop the connector"
note "Offsets can only be altered while the connector is STOPPED."
curl -s -X PUT "$CONNECT/connectors/$NAME/stop" -w '   HTTP %{http_code}\n' -o /dev/null
wait_state "$NAME" STOPPED && note "connector is STOPPED" || note "connector did not stop"

step "4. Rewind  (PATCH /connectors/$NAME/offsets, KIP-875)"
note "Set the file position back to 0 so the connector re-reads from the top."
curl -s -X PATCH -H 'Content-Type: application/json' \
  "$CONNECT/connectors/$NAME/offsets" -d "{
  \"offsets\": [
    { \"partition\": { \"filename\": \"$SRC\" }, \"offset\": { \"position\": 0 } }
  ]
}" | jq_

step "5. Resume and watch it reprocess"
BEFORE=$(consumed)
curl -s -X PUT "$CONNECT/connectors/$NAME/resume" -w '   HTTP %{http_code}\n' -o /dev/null
wait_state "$NAME" RUNNING && note "connector is RUNNING"
sleep 10
AFTER=$(consumed)
note "records before rewind: $BEFORE"
note "records after rewind:  $AFTER"
if [ "$AFTER" -gt "$BEFORE" ]; then
  printf '   \033[32m%s\033[0m\n' "The 10 orders were re-read and republished -- the rewind worked."
else
  printf '   \033[33m%s\033[0m\n' "No new records; the connector may not have polled yet."
fi

step "6. Reset completely  (DELETE /connectors/$NAME/offsets)"
note "A full reset also requires the connector to be stopped."
curl -s -X PUT "$CONNECT/connectors/$NAME/stop" -o /dev/null
wait_state "$NAME" STOPPED
curl -s -X DELETE "$CONNECT/connectors/$NAME/offsets" | jq_
note "offsets after reset:"
curl -s -m 5 "$CONNECT/connectors/$NAME/offsets" | jq_

step "Cleanup"
curl -s -X DELETE "$CONNECT/connectors/$NAME" -w '   deleted connector, HTTP %{http_code}\n' -o /dev/null

step "Done"
note "Each component owns its own offsets. Resetting a Camel consumer group"
note "(Appendix N) does nothing to a connector, and vice versa."
