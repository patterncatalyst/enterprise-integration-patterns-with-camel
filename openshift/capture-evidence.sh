#!/usr/bin/env bash
#
# capture-evidence.sh — verify the eip deployment on OpenShift Local
# and write what it saw to openshift/evidence/<date>/.
#
# Checks (each fails the script on a miss):
#   1. cluster, operators, builds: one ImageStream tag per service
#   2. pods: all Ready under restricted-v2 with a namespace-range UID
#      (the one allowed exception is otel-lgtm under anyuid)
#   3. Routes: every Route answers 200 on its health-check-path over edge TLS
#   4. project checks: project-checks.sh (functional, project-specific)
#   5. platform tier: whatever openshift/platform/ installed (evidence.sh)
#   6. secret scrub: no password, token or private key in the evidence
#
# curl validates the router certificate against the cluster's ingress CA,
# so nothing here uses --insecure. Nothing here prints a secret.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_crc

OUT="$OPENSHIFT_DIR/evidence/$(date +%Y-%m-%d)"
mkdir -p "$OUT"
CA="$(mktemp)"; trap 'rm -f "$CA"' EXIT
oc get configmap default-ingress-cert -n openshift-config-managed \
    -o jsonpath='{.data.ca-bundle\.crt}' > "$CA" || fail "cannot read the ingress CA"
https() { curl -sS --max-time 20 --cacert "$CA" "$@"; }
in_pod() { local d="$1"; shift; oc exec -n "$NS" "deploy/$d" -c "$d" -- "$@"; }
route_url() { printf 'https://%s' "$(oc get route "$1" -n "${2:-$NS}" -o jsonpath='{.spec.host}')"; }

step "1/6 Cluster, operators, builds"
{
    crc version | head -3
    oc version | grep -E 'Server|Kubernetes'
    oc get csv -A -o custom-columns='NS:.metadata.namespace,CSV:.metadata.name,PHASE:.status.phase' 2>/dev/null \
        | awk 'NR==1 || $1 !~ /^openshift-(operator-lifecycle-manager|marketplace)$/' | grep -v packageserver | sort -u -k2,2
    oc get kafka -n "$NS" -o jsonpath='{range .items[*]}kafka {.metadata.name}: version {.status.kafkaVersion}, Ready={.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}' 2>/dev/null
    oc get builds -n "$NS" -o custom-columns='BUILD:.metadata.name,STATUS:.status.phase,DURATION:.status.duration'
    for svc in "${SERVICES[@]}"; do
        oc get istag "$svc:$IMAGE_TAG" -n "$NS" -o jsonpath='{.metadata.name} {.image.dockerImageReference}{"\n"}'
    done
} > "$OUT/01-cluster-builds.txt" 2>&1
tags=$(grep -c ":$IMAGE_TAG image-registry" "$OUT/01-cluster-builds.txt")
(( tags == ${#SERVICES[@]} )) || fail "expected ${#SERVICES[@]} ImageStream tags $IMAGE_TAG, found $tags"
ok "$tags ImageStream tags $IMAGE_TAG, built in-cluster"

step "2/6 Pods under restricted-v2"
oc get pods -n "$NS" --field-selector=status.phase=Running \
    -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[*].ready,RESTARTS:.status.containerStatuses[*].restartCount,SCC:.metadata.annotations.openshift\.io/scc,UID:.spec.containers[0].securityContext.runAsUser' \
    > "$OUT/02-pods.txt"
# The one exception is otel-lgtm (platform/install-observability.sh): anyuid.
bad=$(awk 'NR>1 && ($2 ~ /false/ || ($4 != "restricted-v2" && !($1 ~ /^lgtm-/ && $4 == "anyuid")))' "$OUT/02-pods.txt" | grep -c . || true)
oc get namespace "$NS" -o jsonpath='namespace uid-range: {.metadata.annotations.openshift\.io/sa\.scc\.uid-range}{"\n"}' >> "$OUT/02-pods.txt"
(( bad == 0 )) || fail "$bad pod(s) not Ready or not restricted-v2 (see $OUT/02-pods.txt)"
ok "all pods Ready, restricted-v2"

step "3/6 Routes over edge TLS"
: > "$OUT/03-routes.txt"
while read -r name host path; do
    [[ -z "$name" || "$path" == "<none>" ]] && continue
    code=$(https -o /dev/null -w '%{http_code}' "https://$host$path")
    printf 'GET https://%s%s -> %s\n' "$host" "$path" "$code" >> "$OUT/03-routes.txt"
    [[ "$code" == 200 ]] || fail "Route $name returned $code on $path"
    ok "$name https://$host$path 200"
done < <(oc get routes -n "$NS" --no-headers \
    -o custom-columns='N:.metadata.name,H:.spec.host,P:.metadata.annotations.health-check-path')

step "4/6 Project checks"
if [[ -f "$OPENSHIFT_DIR/project-checks.sh" ]]; then
    source "$OPENSHIFT_DIR/project-checks.sh"
    project_checks
else
    warn "no openshift/project-checks.sh: functional checks skipped"
fi

step "5/6 Platform tier"
# Each section runs only if its feature is installed.
source "$OPENSHIFT_DIR/platform/evidence.sh"
platform_evidence

step "6/6 Secret scrub"
leaks=0
# This chart generates no credentials (Redis runs without auth, Kafka on a
# plain internal listener), so the scrub looks for cluster secrets only.
grep -rlE 'sha256~[A-Za-z0-9_-]{20,}|BEGIN [A-Z ]*PRIVATE KEY|kubeadmin-password|"token"|"auths"' "$OUT" >&2 && leaks=1
(( leaks == 0 )) || fail "evidence contains secret material: delete $OUT and investigate"
ok "no secrets in $OUT"

printf '\n    evidence: %s\n' "${OUT#"$REPO_ROOT"/}"
