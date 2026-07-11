#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_ROOT/examples/_infra"

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
  podman-compose -p eip -f "$INFRA_DIR/compose.yaml" down -v 2>/dev/null || true
  for vol in eip-kafka-data eip-pulsar-data eip-redis-data eip-postgres-data; do
    podman volume rm "$vol" 2>/dev/null || true
  done
  echo "    Volumes removed."
fi

echo "==> Starting EIP base stack (Kafka, Pulsar, Redis, PostgreSQL, Apicurio)..."
podman-compose -p eip -f "$INFRA_DIR/compose.yaml" up -d

echo "==> Waiting for base services to become healthy..."
wait_healthy() {
  local svc=$1
  local svc_timeout=${2:-120}
  printf "    %-20s " "$svc"
  while ! podman inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null | grep -q healthy; do
    sleep 2
    svc_timeout=$((svc_timeout - 2))
    if [[ $svc_timeout -le 0 ]]; then
      echo "TIMEOUT"
      echo "ERROR: $svc did not become healthy within the timeout"
      exit 1
    fi
  done
  echo "healthy"
}

wait_healthy eip-kafka    120
wait_healthy eip-redis    120
wait_healthy eip-postgres 120
wait_healthy eip-apicurio 120
wait_healthy eip-pulsar   180

echo "==> Base stack ready."
echo "    Kafka UI:    http://localhost:8090"
echo "    Pulsar Admin: http://localhost:8080"
echo "    PostgreSQL:   psql -h localhost -U eipuser -d eipdb"
echo "    Apicurio:     http://localhost:8081"
echo "    Redis:        redis-cli -h localhost"

if $LGTM; then
  echo ""
  echo "==> Starting LGTM observability stack..."
  podman-compose -p eip -f "$INFRA_DIR/compose.yaml" -f "$INFRA_DIR/compose.lgtm.yaml" up -d

  echo "==> Waiting for LGTM services..."
  for svc in eip-loki eip-tempo eip-mimir eip-otel-collector eip-grafana; do
    wait_healthy "$svc" 120
  done

  echo "==> LGTM stack ready."
  echo "    Grafana:        http://localhost:3000"
  echo "    OTel Collector: localhost:4317 (gRPC) / localhost:4318 (HTTP)"
fi

echo ""
echo "==> All services up. Run your Camel examples against this stack."
