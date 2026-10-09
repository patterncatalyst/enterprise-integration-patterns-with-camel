# evidence.sh — platform-tier checks for capture-evidence.sh (sourced, not
# run). Each section runs only when its feature is installed and writes
# $OUT/1N-*.txt; every check fails the capture on a miss. Expects lib.sh,
# $OUT, https(), in_pod() and route_url() from capture-evidence.sh.
#
# The load is project-specific: an order burst through the eip-k8s-deploy
# Route for KEDA, and one order that produces a trace for OpenTelemetry.

keda_on()   { [[ -n "$(oc get scaledobject -n "$NS" -o name 2>/dev/null)" ]]; }
otel_on()   { oc get instrumentation "$RELEASE-java" -n "$NS" >/dev/null 2>&1; }

# post_orders <n> <prefix>: send n orders through the eip-k8s-deploy Route.
post_orders() {
    local n="$1" prefix="$2" url i
    url="$(route_url eip-k8s-deploy)/api/orders"
    for i in $(seq 1 "$n"); do
        https -o /dev/null -X POST "$url" -H 'Content-Type: application/json' \
            -d "{\"orderId\":\"$prefix-$i\",\"customerId\":\"C-10$(( i % 6 ))\",\"item\":\"Pallet\",\"quantity\":1}" || return 1
    done
}

evidence_keda() {
    step "P2 Autoscaling (Custom Metrics Autoscaler)"
    local f="$OUT/12-keda.txt"
    oc get scaledobject -n "$NS" \
        -o custom-columns='NAME:.metadata.name,TARGET:.spec.scaleTargetRef.name,MIN:.spec.minReplicaCount,MAX:.spec.maxReplicaCount,READY:.status.conditions[?(@.type=="Ready")].status,ACTIVE:.status.conditions[?(@.type=="Active")].status' \
        > "$f" 2>&1
    awk 'NR>1 && $5 != "True"' "$f" | grep -q . && fail "a ScaledObject is not Ready (see $f)"
    ok "ScaledObjects Ready"
    # Drive lag on eip.orders.incoming and record the replica count. The
    # processor is fast, so a burst may drain before KEDA's 15 s poll sees
    # lag: a scale-out is recorded when it happens, not required.
    local max=1 r i
    post_orders 600 "KEDA-$(date +%s)" || fail "order burst through the Route failed"
    for i in $(seq 1 24); do
        r=$(oc get deployment eip-k8s-deploy -n "$NS" -o jsonpath='{.status.replicas}'); r=${r:-0}
        printf '%s replicas=%s\n' "$(date +%T)" "$r" >> "$f"
        (( r > max )) && max=$r
        sleep 5
    done
    oc get hpa -n "$NS" >> "$f" 2>&1
    if (( max > 1 )); then ok "eip-k8s-deploy scaled to $max replicas on lag"; else warn "no scale-out observed (lag drained within one poll); see $f"; fi
}

evidence_otel() {
    step "P3 Tracing (OpenTelemetry Java agent -> otel-lgtm)"
    local f="$OUT/13-tracing.txt" code
    {
        printf -- '-- pods with the injected agent\n'
        oc get pods -n "$NS" -l "app.kubernetes.io/part-of=$PROJECT" --field-selector=status.phase=Running \
            -o custom-columns='POD:.metadata.name,INIT:.spec.initContainers[*].name' | grep -E 'POD|opentelemetry-auto-instrumentation'
        printf '\n-- recent traces (Tempo), after one order through the Route\n'
        post_orders 1 "TRACE-$(date +%s)"
        sleep 10
        oc exec -n "$NS" deploy/lgtm -c lgtm -- curl -s "localhost:3200/api/search?limit=20" | jq -r '.traces[]? | "\(.rootServiceName): \(.rootTraceName)"' | sort | uniq -c
    } > "$f" 2>&1
    grep -q opentelemetry-auto-instrumentation "$f" || fail "no pod carries the injected Java agent"
    grep -q 'eip-k8s-deploy' "$f" || fail "Tempo has no trace from eip-k8s-deploy"
    code=$(https -o /dev/null -w '%{http_code}' "$(route_url grafana)/api/health")
    printf '\nGrafana /api/health through its Route: %s\n' "$code" >> "$f"
    [[ "$code" == 200 ]] || fail "Grafana Route returned $code"
    ok "agent injected; Grafana Route 200"
}

platform_evidence() {
    keda_on && evidence_keda
    otel_on && evidence_otel
    return 0
}
