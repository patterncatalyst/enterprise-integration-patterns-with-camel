#!/usr/bin/env bash
#
# install-observability.sh — tracing on OpenShift Local: the Red Hat build
# of OpenTelemetry operator injects the OpenTelemetry Java agent into every
# JVM service (an annotation; no pom or image change), and the chart's
# observability flag deploys grafana/otel-lgtm with a Grafana Route.
#
#   ./openshift/platform/install-observability.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
PLATFORM="$OPENSHIFT_DIR/platform"

OTEL_CSV="opentelemetry-operator.v0.158.0-2"

require_crc
helm status "$RELEASE" -n "$NS" --kube-context "$OCP_CONTEXT" >/dev/null 2>&1 || fail "core not deployed: run deploy.sh first"

step "1/3 OpenTelemetry operator"
install_operator "$PLATFORM/subscriptions/opentelemetry.yaml" openshift-opentelemetry-operator \
    opentelemetry-product "$OTEL_CSV"

step "2/3 Instrumentation CR and otel-lgtm"
"$OPENSHIFT_DIR/deploy.sh" --set observability.enabled=true >/dev/null || fail "deploy.sh with observability.enabled failed"
oc get instrumentation "$RELEASE-java" -n "$NS" >/dev/null 2>&1 || fail "Instrumentation $RELEASE-java missing"
oc rollout status deployment/lgtm -n "$NS" --timeout=600s >/dev/null || fail "otel-lgtm not Ready"
ok "otel-lgtm Ready (SCC $(oc get pod -n "$NS" -l app.kubernetes.io/name=lgtm -o jsonpath='{.items[0].metadata.annotations.openshift\.io/scc}'))"

step "3/3 Agent injection"
# Helm creates the Deployments before the Instrumentation CR, so pods that
# started in the same upgrade may have missed the injection webhook.
# Restart whatever is annotated but lacks the agent's init container.
for d in $(oc get deployment -n "$NS" -l "app.kubernetes.io/part-of=$PROJECT" -o name); do
    oc get "$d" -n "$NS" -o jsonpath='{.spec.template.metadata.annotations}' | grep -q inject-java || continue
    pod="$(oc get pod -n "$NS" -l "app.kubernetes.io/name=${d#deployment.apps/}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
    [[ -z "$pod" ]] && continue   # scaled to zero (KEDA): injected on its next start
    oc get pod "$pod" -n "$NS" -o jsonpath='{.spec.initContainers[*].name}' | grep -q opentelemetry-auto-instrumentation \
        || oc rollout restart "$d" -n "$NS" >/dev/null
done
for d in $(oc get deployment -n "$NS" -l "app.kubernetes.io/part-of=$PROJECT" -o name); do
    oc rollout status "$d" -n "$NS" --timeout=600s >/dev/null || fail "$d did not roll out"
done
ok "Java agent injected; Grafana https://$(oc get route grafana -n "$NS" -o jsonpath='{.spec.host}')"

