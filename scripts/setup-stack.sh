#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_ROOT/examples/_infra"

LGTM=false
if [[ "${1:-}" == "--lgtm" ]]; then
  LGTM=true
fi

echo "==> Starting EIP base stack (Kafka, Pulsar, Redis, PostgreSQL, Apicurio)..."
podman-compose -p eip -f "$INFRA_DIR/compose.yaml" up -d

echo "==> Waiting for base services to become healthy..."
services=(eip-kafka eip-redis eip-postgres eip-apicurio eip-pulsar)
for svc in "${services[@]}"; do
  printf "    %-20s " "$svc"
  timeout=120
  while ! podman inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null | grep -q healthy; do
    sleep 2
    timeout=$((timeout - 2))
    if [[ $timeout -le 0 ]]; then
      echo "TIMEOUT"
      echo "ERROR: $svc did not become healthy within 120s"
      exit 1
    fi
  done
  echo "healthy"
done

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

  lgtm_services=(eip-loki eip-tempo eip-mimir eip-otel-collector eip-grafana)
  echo "==> Waiting for LGTM services..."
  for svc in "${lgtm_services[@]}"; do
    printf "    %-20s " "$svc"
    timeout=120
    while ! podman inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null | grep -q healthy; do
      sleep 2
      timeout=$((timeout - 2))
      if [[ $timeout -le 0 ]]; then
        echo "TIMEOUT"
        echo "ERROR: $svc did not become healthy within 120s"
        exit 1
      fi
    done
    echo "healthy"
  done

  echo "==> LGTM stack ready."
  echo "    Grafana:        http://localhost:3000"
  echo "    OTel Collector: localhost:4317 (gRPC) / localhost:4318 (HTTP)"
fi

echo ""
echo "==> All services up. Run your Camel examples against this stack."
