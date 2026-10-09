# project-checks.sh — functional checks for eip (sourced by
# capture-evidence.sh, not run): Appendix T's pipeline end to end on
# OpenShift Local. One order goes in through the edge-TLS Route; the
# OrderProcessorRoute must consume it from Kafka, enrich it from Redis and
# publish it to eip.orders.enriched.
#
# Available from capture-evidence.sh: lib.sh helpers (step, ok, fail,
# wait_for), $OUT, https (curl with the ingress CA), in_pod <deploy> <cmd...>
# (oc exec into the service's own container), route_url <route> [ns].

project_checks() {
    local f="$OUT/04-project.txt" url order reply
    url="$(route_url eip-k8s-deploy)"
    order="ORD-CRC-$(date +%s)"

    in_pod eip-k8s-deploy curl -fsS localhost:8088/q/health/ready > "$f" 2>&1 \
        || fail "eip-k8s-deploy not ready from inside its pod"
    ok "eip-k8s-deploy answers /q/health/ready in-pod"

    # The CacheLoaderRoute seeds Redis five seconds after start; wait for it.
    seeded() { oc exec -n "$NS" deploy/redis -c redis -- redis-cli GET customer:C-101 | grep -q 'Global Freight Ltd'; }
    wait_for 120 "Redis seeded by CacheLoaderRoute" seeded

    reply=$(https -X POST "$url/api/orders" -H 'Content-Type: application/json' \
        -d "{\"orderId\":\"$order\",\"customerId\":\"C-101\",\"item\":\"Shipping Container\",\"quantity\":2}")
    printf '\nPOST %s/api/orders -> %s\n' "$url" "$reply" >> "$f"
    [[ "$reply" == *accepted* ]] || fail "POST /api/orders through the Route returned: $reply"
    ok "POST /api/orders through the Route accepted $order"

    # Wait for the side effect, not a fixed sleep.
    enriched() { oc logs -n "$NS" deploy/eip-k8s-deploy -c eip-k8s-deploy --since=5m 2>/dev/null \
        | grep 'Enriched order published' | grep "$order" | grep -q 'Global Freight Ltd'; }
    wait_for 120 "$order enriched from Redis and published to eip.orders.enriched" enriched
    oc logs -n "$NS" deploy/eip-k8s-deploy -c eip-k8s-deploy --since=5m | grep "$order" >> "$f"

    # And it is on the topic: read it back from the broker pod.
    oc exec -n "$NS" "$PROJECT-dual-role-0" -c kafka -- bin/kafka-console-consumer.sh \
        --bootstrap-server localhost:9092 --topic eip.orders.enriched --from-beginning \
        --timeout-ms 15000 2>/dev/null | grep "$order" >> "$f" \
        || fail "$order not found on eip.orders.enriched"
    ok "$order on eip.orders.enriched"
}
