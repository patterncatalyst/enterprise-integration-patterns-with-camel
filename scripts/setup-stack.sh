#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_ROOT/examples/_infra"

# Docker Engine (docker-ce) with the Compose v2 plugin, on the default context.
# The legacy docker-compose binary is not supported.
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found. Install Docker Engine (docker-ce) — see docs/00-prerequisites."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: the docker compose plugin is missing: sudo dnf install docker-compose-plugin"; exit 1; }
docker info >/dev/null 2>&1 || { echo "ERROR: cannot reach the Docker daemon: sudo systemctl enable --now docker, and add yourself to the docker group"; exit 1; }
ctx="$(docker context show 2>/dev/null || echo default)"
[[ "$ctx" == "default" ]] || echo "WARNING: docker context is '$ctx', not 'default'; the stack starts wherever that context points."

LGTM=false
CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --lgtm)  LGTM=true ;;
    --clean) CLEAN=true ;;
  esac
done

if $CLEAN; then
  echo "==> Cleaning existing stack and volumes..."
  docker compose -p eip -f "$INFRA_DIR/compose.yaml" down -v 2>/dev/null || true
  for vol in eip-kafka-data eip-pulsar-data eip-redis-data eip-postgres-data; do
    docker volume rm "$vol" 2>/dev/null || true
  done
  echo "    Volumes removed."
fi

# Pulsar's embedded BookKeeper corrupts its ledger data across dirty shutdowns.
# If Pulsar is sitting in a crashed state, wipe its volume before restarting.
#
# This only catches the case where the container still exists. After a
# `docker compose down` the container is gone while the corrupt volume remains,
# and the next start fails with "Bookie handle is not available". The recovery
# after the health wait below handles that case.
pulsar_status=$(docker inspect --format='{{.State.Status}}' eip-pulsar 2>/dev/null || echo "absent")
if [[ "$pulsar_status" == "exited" ]] || [[ "$pulsar_status" == "dead" ]]; then
  echo "==> Detected crashed Pulsar container — cleaning volume to prevent ledger corruption..."
  docker rm eip-pulsar 2>/dev/null || true
  docker volume rm eip-pulsar-data 2>/dev/null || true
  echo "    Pulsar volume cleaned."
fi

echo "==> Starting EIP base stack (Kafka, Pulsar, Redis, PostgreSQL, Apicurio)..."
docker compose -p eip -f "$INFRA_DIR/compose.yaml" up -d

echo "==> Waiting for base services to become healthy..."
# wait_healthy <service> [timeout] [nonfatal]
# With "nonfatal" it returns 1 instead of exiting, so a caller can attempt
# recovery rather than the whole script dying.
wait_healthy() {
  local svc=$1
  local svc_timeout=${2:-120}
  local mode=${3:-fatal}
  printf "    %-20s " "$svc"
  while ! docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null | grep -q healthy; do
    # A container that has exited will never become healthy; stop waiting.
    local state
    state=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo absent)
    if [[ "$state" == "exited" ]] || [[ "$state" == "dead" ]]; then svc_timeout=0; fi
    if [[ $svc_timeout -le 0 ]]; then
      echo "FAILED"
      [[ "$mode" == "nonfatal" ]] && return 1
      echo "ERROR: $svc did not become healthy within the timeout"
      docker logs --tail 15 "$svc" 2>&1 | sed 's/^/      /'
      exit 1
    fi
    sleep 2
    svc_timeout=$((svc_timeout - 2))
  done
  echo "healthy"
}

# The LGTM images (Loki, Tempo, Mimir, OTel Collector) are distroless — they
# carry no shell, wget or curl, so a container healthcheck cannot run inside
# them. Poll their HTTP readiness endpoints from the host instead.
wait_ready() {
  local svc=$1
  local url=$2
  local svc_timeout=${3:-120}
  printf "    %-20s " "$svc"
  while ! curl -sf -m 3 -o /dev/null "$url"; do
    if ! docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null | grep -q running; then
      echo "EXITED"
      echo "ERROR: $svc is not running. Logs:"
      docker logs --tail 20 "$svc" 2>&1 | sed 's/^/      /'
      exit 1
    fi
    sleep 2
    svc_timeout=$((svc_timeout - 2))
    if [[ $svc_timeout -le 0 ]]; then
      echo "TIMEOUT"
      echo "ERROR: $svc did not become ready within the timeout"
      docker logs --tail 20 "$svc" 2>&1 | sed 's/^/      /'
      exit 1
    fi
  done
  echo "ready"
}

wait_healthy eip-kafka    120
wait_healthy eip-redis    120
wait_healthy eip-postgres 120
wait_healthy eip-apicurio 120
# Pulsar gets one automatic recovery attempt. A corrupt bookie ledger is by far
# the most common reason it fails here, the only fix is to wipe the volume, and
# the data is throwaway development state.
if ! wait_healthy eip-pulsar 180 nonfatal; then
  echo "    Pulsar did not come up. This is almost always a corrupt BookKeeper"
  echo "    ledger from an unclean shutdown. Wiping its volume and retrying once."
  docker rm -f eip-pulsar >/dev/null 2>&1 || true
  docker volume rm eip-pulsar-data >/dev/null 2>&1 || true
  docker compose -p eip -f "$INFRA_DIR/compose.yaml" up -d pulsar >/dev/null 2>&1
  wait_healthy eip-pulsar 180
fi

# flagd is distroless, so it gets the host-side readiness poll too.
wait_ready eip-flagd http://localhost:8014/healthz 60

echo "==> Base stack ready."
echo "    Kafka UI:    http://localhost:8090"
echo "    Pulsar Admin: http://localhost:8080"
echo "    PostgreSQL:   psql -h localhost -U eipuser -d eipdb"
echo "    Apicurio:     http://localhost:8081"
echo "    Redis:        redis-cli -h localhost"
echo "    flagd:        localhost:8013 (gRPC), http://localhost:8014/healthz"

if $LGTM; then
  echo ""
  echo "==> Starting LGTM observability stack..."
  docker compose -p eip -f "$INFRA_DIR/compose.yaml" -f "$INFRA_DIR/compose.lgtm.yaml" up -d

  echo "==> Waiting for LGTM services..."
  wait_ready eip-loki           http://localhost:3100/ready        120
  wait_ready eip-tempo          http://localhost:3200/ready        120
  wait_ready eip-mimir          http://localhost:9009/ready        150
  wait_ready eip-otel-collector http://localhost:13133/            60
  wait_healthy eip-grafana      120

  echo "==> LGTM stack ready."
  echo "    Grafana:        http://localhost:3000"
  echo "    Loki:           http://localhost:3100"
  echo "    Tempo:          http://localhost:3200"
  echo "    Mimir:          http://localhost:9009"
  echo "    OTel Collector: localhost:4317 (gRPC) / localhost:4318 (HTTP)"
fi

echo ""
echo "==> All services up. Run your Camel examples against this stack."
