#!/usr/bin/env bash
#
# install-platform.sh — the opt-in platform tier on top of a deployed core,
# kept to what the tutorial teaches: Kafka-lag autoscaling of the Competing
# Consumers (Custom Metrics Autoscaler, Red Hat's KEDA) and tracing with the
# OpenTelemetry Java agent into grafana/otel-lgtm (Appendix I's signals).
# Each step is its own script and can run alone.
#
#   ./openshift/platform/install-platform.sh
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
P="$OPENSHIFT_DIR/platform"

require_crc
# Estimate for the core plus both operators and otel-lgtm (2 GiB limit);
# re-measure on the live run.
require_crc_size 8 24576
run() { local start; start=$(date +%s); "$@" || fail "$(basename "$1") failed"; ok "$(basename "$1") done in $(( $(date +%s) - start ))s"; }
run "$P/install-keda.sh"
run "$P/install-observability.sh"
