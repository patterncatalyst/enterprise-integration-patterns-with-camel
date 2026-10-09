#!/usr/bin/env bash
#
# setup-minikube-stack.sh — the Appendix T cluster: a dedicated minikube
# profile with Strimzi Kafka and Redis, ready for
# examples/38-kubernetes-deploy/deploy-minikube.sh.
#
#   ./scripts/setup-minikube-stack.sh            # create/start the profile, install Kafka + Redis
#   ./scripts/setup-minikube-stack.sh --replace  # delete and recreate the profile first
#   ./scripts/setup-minikube-stack.sh --clean    # remove Kafka, Redis and the app, then stop the profile
#   ./scripts/setup-minikube-stack.sh --delete   # delete the profile entirely
#
# Runtime rules (Appendix T):
#   - Docker Engine (docker-ce, context "default"), minikube --driver=docker
#     --container-runtime=containerd. No desktop app.
#   - Host access is a NodePort published on 127.0.0.1 when the profile is
#     created (--ports). No port-forward, no tunnel, no `minikube service`.
#     Ports are fixed at creation: adding one means --replace.
#   - Every call names its target: minikube -p, kubectl --context,
#     helm --kube-context. Never `minikube config set`.
#   - One local cluster at a time: refuses to run beside a running CRC.
set -euo pipefail

PROFILE="${MINIKUBE_PROFILE:-eip}"
CTX="$PROFILE"
KUBERNETES_VERSION="${KUBERNETES_VERSION:-v1.36.5}"
MINIKUBE_MIN="1.39.0"
STRIMZI_VERSION="${STRIMZI_VERSION:-1.2.0}"
CPUS="${MINIKUBE_CPUS:-4}"
MEMORY="${MINIKUBE_MEMORY:-8192}"
# Host port = NodePort. The Camel API (examples/38-kubernetes-deploy).
APP_NODEPORT=30088

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_INFRA_DIR="$PROJECT_ROOT/examples/38-kubernetes-deploy/k8s-infra"

MODE=up
for arg in "$@"; do
  case "$arg" in
    --clean)   MODE=clean ;;
    --delete)  MODE=delete ;;
    --replace) MODE=replace ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }
k() { kubectl --context "$CTX" "$@"; }
h() { helm --kube-context "$CTX" "$@"; }
profile_exists() { minikube profile list -o json 2>/dev/null | jq -e --arg p "$PROFILE" '.valid[]? | select(.Name == $p)' >/dev/null; }

# ── Preflight ────────────────────────────────────────────────────────────────
for tool in docker minikube kubectl helm jq; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool not found on PATH (see Appendix T prerequisites)"
done
docker info >/dev/null 2>&1 || fail "cannot reach the Docker daemon: sudo systemctl enable --now docker; add yourself to the docker group"
ctx="$(docker context show 2>/dev/null || echo default)"
[[ "$ctx" == "default" ]] || fail "docker context is '$ctx'; minikube's docker driver needs the local daemon: docker context use default"
mk="$(minikube version --short 2>/dev/null | sed 's/^v//')"
[[ "$(printf '%s\n%s\n' "$MINIKUBE_MIN" "$mk" | sort -V | head -1)" == "$MINIKUBE_MIN" ]] \
  || fail "minikube $mk is older than $MINIKUBE_MIN"
if command -v crc >/dev/null 2>&1 && crc status 2>/dev/null | grep -q 'OpenShift:.*Running'; then
  fail "OpenShift Local (CRC) is running: run one local cluster at a time (./openshift/teardown.sh or crc stop)"
fi

if [[ "$MODE" == delete ]]; then
  echo "==> Deleting minikube profile $PROFILE"
  minikube delete -p "$PROFILE"
  exit 0
fi

if [[ "$MODE" == clean ]]; then
  profile_exists || { echo "    no profile $PROFILE"; exit 0; }
  if ! minikube status -p "$PROFILE" >/dev/null 2>&1; then
    echo "    profile $PROFILE is not running; nothing to clean"; exit 0
  fi
  echo "==> Removing the application, Kafka and Redis from $PROFILE"
  k delete deployment,service,configmap -l app.kubernetes.io/name=eip-k8s-deploy --ignore-not-found >/dev/null
  k delete deployment/eip-k8s-deploy service/eip-k8s-deploy configmap/eip-k8s-config --ignore-not-found >/dev/null
  # Topics and the cluster go while the operator still runs (finalizers).
  k delete -f "$K8S_INFRA_DIR/kafka-topics.yaml" --ignore-not-found --wait=true >/dev/null 2>&1 || true
  k delete -f "$K8S_INFRA_DIR/kafka-cluster.yaml" --ignore-not-found --wait=true >/dev/null 2>&1 || true
  h uninstall strimzi -n kafka >/dev/null 2>&1 || true
  k delete -f "$K8S_INFRA_DIR/redis.yaml" --ignore-not-found >/dev/null 2>&1 || true
  k delete namespace kafka --ignore-not-found >/dev/null
  echo "==> Stopping profile $PROFILE (stop, not delete; --delete removes it)"
  minikube stop -p "$PROFILE"
  exit 0
fi

if [[ "$MODE" == replace ]] && profile_exists; then
  echo "==> Deleting profile $PROFILE before recreating it"
  minikube delete -p "$PROFILE"
fi

# ── Profile ──────────────────────────────────────────────────────────────────
if profile_exists; then
  echo "==> Starting existing profile $PROFILE (ports were fixed at creation)"
  minikube start -p "$PROFILE"
else
  if ss -ltn "sport = :$APP_NODEPORT" | grep -q LISTEN; then
    fail "host port $APP_NODEPORT is already in use: ss -ltnp 'sport = :$APP_NODEPORT'"
  fi
  echo "==> Creating profile $PROFILE (Kubernetes $KUBERNETES_VERSION, docker driver, containerd, $CPUS CPU / $MEMORY MiB)"
  minikube start -p "$PROFILE" \
    --driver=docker --container-runtime=containerd \
    --kubernetes-version="$KUBERNETES_VERSION" \
    --cpus="$CPUS" --memory="$MEMORY" \
    --ports="127.0.0.1:$APP_NODEPORT:$APP_NODEPORT"
fi
minikube -p "$PROFILE" addons enable metrics-server >/dev/null
echo "    published: $(docker port "$PROFILE" | grep -c "127.0.0.1:$APP_NODEPORT") NodePort mapping(s) for $APP_NODEPORT"

# ── Strimzi + Kafka ──────────────────────────────────────────────────────────
echo "==> Strimzi $STRIMZI_VERSION (namespace kafka)"
h upgrade --install strimzi oci://quay.io/strimzi-helm/strimzi-kafka-operator \
  --version "$STRIMZI_VERSION" -n kafka --create-namespace --wait --timeout 300s >/dev/null

echo "==> Kafka cluster eip-kafka (KRaft, one dual-role node, Kafka 4.3.1)"
k apply -f "$K8S_INFRA_DIR/kafka-cluster.yaml" >/dev/null
k wait kafka/eip-kafka -n kafka --for=condition=Ready --timeout=600s >/dev/null \
  || fail "Kafka not Ready: kubectl --context $CTX get pods -n kafka; kubectl --context $CTX describe kafka eip-kafka -n kafka"
k apply -f "$K8S_INFRA_DIR/kafka-topics.yaml" >/dev/null
for t in eip.orders.incoming eip.orders.enriched; do
  k wait "kafkatopic/$t" -n kafka --for=condition=Ready --timeout=120s >/dev/null || fail "topic $t not Ready"
done
echo "    eip-kafka Ready; topics eip.orders.incoming, eip.orders.enriched"

# ── Redis ────────────────────────────────────────────────────────────────────
echo "==> Redis (namespace redis)"
k apply -f "$K8S_INFRA_DIR/redis.yaml" >/dev/null
k rollout status deployment/redis -n redis --timeout=180s >/dev/null || fail "Redis did not roll out"

echo ""
echo "==> Profile $PROFILE ready."
echo "    Kafka bootstrap (in-cluster): eip-kafka-kafka-bootstrap.kafka.svc.cluster.local:9092"
echo "    Redis (in-cluster):           redis.redis.svc.cluster.local:6379"
echo "    Camel API, once deployed:     http://127.0.0.1:$APP_NODEPORT/api/orders"
echo "    Next: examples/38-kubernetes-deploy/deploy-minikube.sh quarkus   (or spring-boot)"
