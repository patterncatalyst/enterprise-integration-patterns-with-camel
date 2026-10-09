#!/usr/bin/env bash
#
# install-keda.sh — the Custom Metrics Autoscaler (Red Hat's KEDA) and the
# chart's keda flag: every service with a `keda:` block in values.yaml gets
# a Kafka-lag ScaledObject (0 -> N on lag, back to 0 after the cooldown).
#
#   ./openshift/platform/install-keda.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
PLATFORM="$OPENSHIFT_DIR/platform"

CMA_CSV="custom-metrics-autoscaler.v2.19.0-4"

require_crc
helm status "$RELEASE" -n "$NS" --kube-context "$OCP_CONTEXT" >/dev/null 2>&1 || fail "core not deployed: run deploy.sh first"

step "1/3 Custom Metrics Autoscaler operator"
install_operator "$PLATFORM/subscriptions/custom-metrics-autoscaler.yaml" openshift-keda \
    openshift-custom-metrics-autoscaler-operator "$CMA_CSV"

step "2/3 KedaController"
oc apply -f "$PLATFORM/keda/kedacontroller.yaml" >/dev/null || fail "apply KedaController"
for d in keda-operator keda-metrics-apiserver keda-admission; do
    wait_for 300 "$d created" oc get deployment "$d" -n openshift-keda
    oc rollout status "deployment/$d" -n openshift-keda --timeout=300s >/dev/null || fail "$d not Ready"
done
ok "KEDA operator, metrics API server and admission webhooks Ready"

step "3/3 ScaledObjects"
"$OPENSHIFT_DIR/deploy.sh" --set keda.enabled=true >/dev/null || fail "deploy.sh with keda.enabled failed"
sos="$(oc get scaledobject -n "$NS" -o name)"
[[ -n "$sos" ]] || fail "no ScaledObject rendered: give a service a keda: block in values.yaml"
for so in $sos; do
    oc wait "$so" -n "$NS" --for=condition=Ready --timeout=120s >/dev/null \
        || fail "$so not Ready (oc describe $so -n $NS; 'no such host' means a short bootstrap name)"
    ok "$so Ready"
done
