#!/usr/bin/env bash
#
# install-infra.sh — the eip project on OpenShift Local (CRC), plus
# Kafka from the AMQ Streams operator (pinned, from OperatorHub). Redis
# ships in the Helm chart (openshift/helm/eip), not here.
#
# Idempotent: re-running skips what already exists. Undo with teardown.sh.
#
#   eval "$(crc oc-env)"
#   ./openshift/install-infra.sh
#   ENABLE_KAFKA=false ./openshift/install-infra.sh   # project only
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ENABLE_KAFKA="${ENABLE_KAFKA:-true}"
# Newest CSV in the channel when this was written; re-check with
#   oc get packagemanifest amq-streams -n openshift-marketplace \
#     -o jsonpath='{range .status.channels[*]}{.name}{"  "}{.currentCSV}{"\n"}{end}'
# and update infra/amq-streams-subscription.yaml to match.
CSV="amqstreams.v3.2.1-14"

require_crc

step "1/3 Project $NS"
if oc get project "$NS" >/dev/null 2>&1; then
    ok "project $NS exists"
else
    oc new-project "$NS" --display-name="EIP with Apache Camel" >/dev/null || fail "oc new-project $NS"
    ok "project $NS created"
fi

if [[ "$ENABLE_KAFKA" != true ]]; then
    ok "ENABLE_KAFKA=false: no Kafka"
    exit 0
fi

step "2/3 AMQ Streams operator ($CSV)"
refuse_foreign_subscription amq-streams openshift-operators/amq-streams "$CSV"
install_operator "$OPENSHIFT_DIR/infra/amq-streams-subscription.yaml" openshift-operators amq-streams "$CSV"

step "3/3 Kafka cluster $PROJECT (KRaft, 1 dual-role node)"
oc apply -n "$NS" -f "$OPENSHIFT_DIR/infra/kafka.yaml" >/dev/null || fail "apply Kafka"
oc wait "kafka/$PROJECT" -n "$NS" --for=condition=Ready --timeout=900s >/dev/null \
    || fail "Kafka $PROJECT not Ready (oc get pods -n $NS; oc describe kafka $PROJECT -n $NS)"
ok "Kafka $PROJECT Ready"
oc get kafka "$PROJECT" -n "$NS" -o jsonpath='    kafka {.status.kafkaVersion}, bootstrap {.status.listeners[0].bootstrapServers}{"\n"}'
printf '    next: ./openshift/build-images.sh, then ./openshift/deploy.sh\n'
