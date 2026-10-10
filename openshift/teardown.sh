#!/usr/bin/env bash
#
# teardown.sh — return OpenShift Local to a clean state, then stop it.
#
# This CRC is dedicated to eip while it runs, and is cleaned after
# every use, so teardown removes everything the openshift/ scripts added:
#   - the Helm release, the Kafka cluster and the eip project (builds,
#     ImageStreams, PVCs);
#   - the KedaController (platform/install-keda.sh);
#   - every operator (AMQ Streams, Custom Metrics Autoscaler, OpenTelemetry):
#     Subscription, CSV, InstallPlans, the CRDs each CSV owns, and the
#     operator namespaces.
# Custom resources go while their operator still runs, so no finalizer is
# left waiting on an operator that is already gone.
#
#   ./openshift/teardown.sh                 # clean up, then crc stop
#   ./openshift/teardown.sh --keep-running  # clean up, leave CRC running
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

KEEP_RUNNING=false
[[ "${1:-}" == "--keep-running" ]] && KEEP_RUNNING=true

require_crc
gone() { ! oc get "$@" >/dev/null 2>&1; }
has_crd() { oc get crd "$1" >/dev/null 2>&1; }
# A label selector with no matches still exits 0, so test for empty output.
kafka_pods_gone() { [[ -z "$(oc get pod -n "$NS" -l "strimzi.io/cluster=$PROJECT" -o name 2>/dev/null)" ]]; }

# subscription-namespace subscription-name, in removal order (reverse of install)
OPERATORS=(
    "openshift-opentelemetry-operator opentelemetry-product"
    "openshift-keda openshift-custom-metrics-autoscaler-operator"
    "openshift-operators amq-streams"
)
OPERATOR_NAMESPACES=(openshift-opentelemetry-operator openshift-keda)
PLATFORM_CRDS='\.(strimzi\.io|keda\.sh|opentelemetry\.io)$'

step "1/6 Workloads"
if helm status "$RELEASE" -n "$NS" --kube-context "$OCP_CONTEXT" >/dev/null 2>&1; then
    # While KEDA and OpenTelemetry still run and can clear their finalizers.
    helm uninstall "$RELEASE" -n "$NS" --kube-context "$OCP_CONTEXT" --wait >/dev/null || fail "helm uninstall"
    ok "release $RELEASE uninstalled"
fi
if has_crd kafkas.kafka.strimzi.io && oc get project "$NS" >/dev/null 2>&1; then
    # KafkaTopics first: their strimzi.io/topic-operator finalizer hangs the
    # namespace in Terminating once the operator is gone.
    oc delete kafkatopics.kafka.strimzi.io,kafkausers.kafka.strimzi.io --all -n "$NS" --wait=true --timeout=120s >/dev/null 2>&1
    oc delete kafka,kafkanodepool --all -n "$NS" --wait=true --timeout=300s >/dev/null || fail "delete Kafka"
    wait_for 300 "Kafka pods gone" kafka_pods_gone
fi
ok "workloads removed"

step "2/6 Project $NS"
if oc get project "$NS" >/dev/null 2>&1; then
    oc delete project "$NS" --wait=false >/dev/null || fail "delete project"
    wait_for 600 "project $NS deleted" gone namespace "$NS"
else
    ok "no project"
fi

step "3/6 Platform control planes"
has_crd kedacontrollers.keda.sh && oc delete kedacontroller --all -n openshift-keda --wait=true --timeout=300s >/dev/null 2>&1
ok "KedaController removed"

step "4/6 Operators"
for entry in "${OPERATORS[@]}"; do
    read -r ns sub <<<"$entry"
    csv="$(oc get subscriptions.operators.coreos.com "$sub" -n "$ns" -o jsonpath='{.status.installedCSV}' 2>/dev/null)"
    oc delete subscriptions.operators.coreos.com "$sub" -n "$ns" --ignore-not-found >/dev/null
    [[ -z "$csv" ]] && continue
    # Read the owned CRDs before the CSV is gone.
    owned="$(oc get csv "$csv" -n "$ns" -o jsonpath='{range .spec.customresourcedefinitions.owned[*]}{.name}{"\n"}{end}' 2>/dev/null)"
    oc delete csv "$csv" -n "$ns" --wait=true >/dev/null 2>&1
    for ip in $(oc get installplan -n "$ns" -o json 2>/dev/null | jq -r --arg c "$csv" '.items[] | select(.spec.clusterServiceVersionNames | index($c)) | .metadata.name'); do
        oc delete installplan "$ip" -n "$ns" >/dev/null 2>&1
    done
    # shellcheck disable=SC2086
    [[ -n "$owned" ]] && oc delete crd $owned --ignore-not-found --wait=true >/dev/null 2>&1
    ok "$csv removed with $(wc -w <<<"$owned") CRD(s)"
done

step "5/6 Remaining CRDs"
# Anything an operator created outside its CSV's owned list.
crds="$(oc get crd -o name | grep -E "$PLATFORM_CRDS")"
# shellcheck disable=SC2086
[[ -n "$crds" ]] && oc delete $crds --wait=true >/dev/null 2>&1
ok "no platform CRDs left"

step "6/6 Operator namespaces"
for ns in "${OPERATOR_NAMESPACES[@]}"; do
    if oc get namespace "$ns" >/dev/null 2>&1; then
        oc delete namespace "$ns" --wait=false >/dev/null
        wait_for 300 "namespace $ns deleted" gone namespace "$ns"
    fi
done

# A build run while the kube context pointed at `default` (before
# build-images.sh set quarkus.openshift.namespace) leaves its BuildConfig,
# builds and ImageStreams there; the project deletion above never sees them.
oc delete bc/eip-k8s-deploy is/eip-k8s-deploy is/openjdk-25 -n default --ignore-not-found >/dev/null 2>&1
oc delete builds -n default -l buildconfig=eip-k8s-deploy --ignore-not-found >/dev/null 2>&1

leftover="$(
    oc get bc,is -n default --no-headers -o name 2>/dev/null | grep -E '/(eip-k8s-deploy|openjdk-25)$'
    oc get subscriptions.operators.coreos.com -A --no-headers 2>/dev/null
    oc get csv -n openshift-operators --no-headers 2>/dev/null | grep -v -E '^packageserver'
    oc get ns --no-headers -o name | grep -v -E '^namespace/(openshift|kube-|default$|hostpath-provisioner$)'
    oc get crd -o name | grep -E "$PLATFORM_CRDS"
)"
if [[ -z "$leftover" ]]; then
    ok "CRC is clean"
else
    printf '    note: still present (flag it; remove only with approval if another project left it):\n%s\n' "$leftover"
fi

if [[ "$KEEP_RUNNING" == false ]]; then
    step "crc stop"
    crc stop >/dev/null 2>&1 && ok "OpenShift Local stopped" || fail "crc stop"
fi
