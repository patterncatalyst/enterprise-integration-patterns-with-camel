#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_INFRA_DIR="$PROJECT_ROOT/examples/38-kubernetes-deploy/k8s-infra"

CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
  esac
done

if $CLEAN; then
  echo "==> Tearing down Minikube stack..."
  helm uninstall redis -n redis 2>/dev/null || true
  kubectl delete -f "$K8S_INFRA_DIR/kafka-topics.yaml" 2>/dev/null || true
  kubectl delete -f "$K8S_INFRA_DIR/kafka-cluster.yaml" 2>/dev/null || true
  helm uninstall strimzi -n kafka 2>/dev/null || true
  kubectl delete namespace kafka redis 2>/dev/null || true
  minikube delete 2>/dev/null || true
  echo "    Minikube cluster deleted."
  exit 0
fi

# Detect container runtime
if command -v podman &>/dev/null; then
  DRIVER="podman"
elif command -v docker &>/dev/null; then
  DRIVER="docker"
else
  echo "ERROR: Neither podman nor docker found. Install one first."
  exit 1
fi

echo "==> Starting Minikube (driver=$DRIVER, 4 CPUs, 8 GB RAM)..."
minikube start --cpus=4 --memory=8192 --driver="$DRIVER"

echo "==> Enabling Minikube addons..."
minikube addons enable registry
minikube addons enable metrics-server

echo "==> Configuring shell to use Minikube's container runtime..."
echo "    Run this in your shell before building images:"
echo "    eval \$(minikube docker-env)"

echo ""
echo "==> Installing Strimzi Kafka operator..."
helm repo add strimzi https://strimzi.io/charts/ 2>/dev/null || true
helm repo update strimzi
helm install strimzi strimzi/strimzi-kafka-operator \
  -n kafka --create-namespace --wait --timeout 300s

echo "==> Deploying Kafka cluster (single-node KRaft)..."
kubectl apply -f "$K8S_INFRA_DIR/kafka-cluster.yaml"

echo "==> Waiting for Kafka cluster to become ready..."
printf "    %-20s " "eip-kafka"
kubectl wait kafka/eip-kafka \
  --for=condition=Ready \
  -n kafka --timeout=300s 2>/dev/null && echo "ready" || {
  echo "TIMEOUT — check: kubectl get kafka -n kafka"
  exit 1
}

echo "==> Creating Kafka topics..."
kubectl apply -f "$K8S_INFRA_DIR/kafka-topics.yaml"

echo ""
echo "==> Installing Redis (Bitnami, standalone, no auth)..."
helm install redis oci://registry-1.docker.io/bitnamicharts/redis \
  -n redis --create-namespace \
  --set auth.enabled=false \
  --set architecture=standalone \
  --set master.resources.requests.memory=128Mi \
  --set master.resources.limits.memory=256Mi \
  --wait --timeout 300s

echo ""
echo "==> Minikube stack ready."
echo ""
echo "    Kafka bootstrap:  eip-kafka-kafka-bootstrap.kafka.svc.cluster.local:9092"
echo "    Redis:             redis-master.redis.svc.cluster.local:6379"
echo ""
echo "    Port-forward Kafka (for local tools):"
echo "      kubectl port-forward svc/eip-kafka-kafka-bootstrap 9092:9092 -n kafka"
echo ""
echo "    Port-forward Redis (for local tools):"
echo "      kubectl port-forward svc/redis-master 6379:6379 -n redis"
echo ""
echo "==> Build and deploy your Camel application next. See examples/38-kubernetes-deploy/README.md."
