#!/usr/bin/env bash
# Build every Maven project under examples/ and report a per-project pass/fail table.
#
# Used for the pre/post-upgrade regression baseline and by the full retest
# (workstream 3). Mirrors the discovery logic in .github/workflows/examples.yml:
# most examples hold one project per runtime under quarkus/ and spring-boot/,
# a few are a single project rooted at the example directory.
#
#   ./scripts/build-all-examples.sh                 # package, skip tests
#   ./scripts/build-all-examples.sh --with-tests    # verify: package and run every test
#   ./scripts/build-all-examples.sh 04 12 loan      # only matching examples
#
# Exit status is non-zero if any project fails.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

# -ntp is not cosmetic. After a version bump the Quarkus test bootstrap
# downloads deployment artifacts from inside the surefire JVM; Maven's
# transfer listener then prints through surefire's console capture, whose
# lazy class init needs the Quarkus test class loader the bootstrap is
# holding. The test JVM deadlocks with no output (seen on 3.39 -> 3.40).
MVN_ARGS=(-B -ntp package -DskipTests)
FILTERS=()
for arg in "$@"; do
  case "$arg" in
    --with-tests) MVN_ARGS=(-B -ntp verify) ;;
    *) FILTERS+=("$arg") ;;
  esac
done

LOG_DIR="${TMPDIR:-/tmp}/eip-build-logs"
mkdir -p "$LOG_DIR"

# Testcontainers (and the Citrus compose actions) talk to Docker Engine through
# /var/run/docker.sock on the default context -- the same engine the dev stack
# runs on. Fail fast if it is not reachable rather than half-way through.
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: cannot reach the Docker daemon (sudo systemctl enable --now docker; docker group membership)" >&2
  exit 1
fi

matches_filter() {
  [ ${#FILTERS[@]} -eq 0 ] && return 0
  for f in "${FILTERS[@]}"; do
    [[ "$1" == *"$f"* ]] && return 0
  done
  return 1
}

declare -a PASSED=() FAILED=()

build_one() {
  local pom_dir="$1" label="$2"
  local log="$LOG_DIR/${label//\//_}.log"
  printf '  %-46s ' "$label"
  if mvn "${MVN_ARGS[@]}" -f "$pom_dir/pom.xml" > "$log" 2>&1; then
    printf 'PASS\n'
    PASSED+=("$label")
  else
    printf 'FAIL  (%s)\n' "$log"
    FAILED+=("$label")
  fi
}

for root in examples/*/; do
  root="${root%/}"
  name="$(basename "$root")"
  [ "$name" = "_infra" ] && continue
  matches_filter "$name" || continue

  found=0
  for runtime in quarkus spring-boot; do
    if [ -f "$root/$runtime/pom.xml" ]; then
      build_one "$root/$runtime" "$name/$runtime"
      found=1
    fi
  done
  if [ "$found" -eq 0 ] && [ -f "$root/pom.xml" ]; then
    build_one "$root" "$name"
    found=1
  fi
  if [ "$found" -eq 0 ]; then
    printf '  %-46s SKIP  (no pom.xml — not a Maven example)\n' "$name"
  fi
done

echo
echo "Passed: ${#PASSED[@]}    Failed: ${#FAILED[@]}"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo
  echo "Failures:"
  printf '  %s\n' "${FAILED[@]}"
  exit 1
fi
