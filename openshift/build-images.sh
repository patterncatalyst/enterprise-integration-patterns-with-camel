#!/usr/bin/env bash
#
# build-images.sh — build the service images inside OpenShift Local.
#
# Maven packages each service on the host (the fast-jar in
# target/quarkus-app); the quarkus-openshift extension (the `openshift`
# Maven profile in each service pom) then uploads it to a binary S2I build
# on the cluster. The build runs on ubi10/openjdk-25 and pushes ImageStream
# tag <service>:$IMAGE_TAG into the project. No container engine on the
# host, no exposed registry, and the cluster never pulls from Maven Central.
#
#   ./openshift/build-images.sh                  # every service in lib.sh
#   ./openshift/build-images.sh eip-k8s-deploy   # just one
#
# Each service pom carries an inactive `openshift` profile adding
# quarkus-openshift (quarkus-container-image-openshift alone generates no
# BuildConfig); see examples/38-kubernetes-deploy/quarkus/pom.xml.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Newest UBI with the newest JDK, exact tag. Re-check:
#   skopeo list-tags docker://registry.access.redhat.com/ubi10/openjdk-25
# Fallback when ubi10 lacks the runtime: ubi9/openjdk-25 (same JDK).
BASE_JVM_IMAGE="${BASE_JVM_IMAGE:-registry.access.redhat.com/ubi10/openjdk-25:1.24-15}"

require_crc
oc get project "$NS" >/dev/null 2>&1 || fail "project $NS missing: run ./openshift/install-infra.sh first"
command -v mvn >/dev/null 2>&1 || fail "mvn not on PATH"

targets=("$@")
(( ${#targets[@]} )) || targets=("${SERVICES[@]}")

step "Building ${#targets[@]} image(s) in-cluster: ${targets[*]}"
# quarkus.openshift.version sets the BuildConfig's output tag; with
# quarkus.container-image.tag alone it stays at the project version
# (e.g. 1.0.0-SNAPSHOT). The image group is the project, so the
# ImageStream lands in $NS. kubernetes.deploy=false: build and push only,
# the Helm chart owns the Deployments. quarkus.openshift.namespace picks the
# project: on Quarkus 3.40 quarkus.kubernetes-client.namespace (and
# KUBERNETES_NAMESPACE) are ignored and the build lands in the kube context's
# namespace, which `crc start` resets to `default`.
for svc in "${targets[@]}"; do
    dir="$(service_dir "$svc")" || fail "unknown service $svc (see service_dir in lib.sh)"
    ok "$svc <- ${dir#"$REPO_ROOT"/}"
    mvn -B -q -f "$dir/pom.xml" package -DskipTests -Popenshift \
        -Dquarkus.container-image.build=true \
        -Dquarkus.container-image.group="$NS" \
        -Dquarkus.container-image.tag="$IMAGE_TAG" \
        -Dquarkus.openshift.version="$IMAGE_TAG" \
        -Dquarkus.openshift.base-jvm-image="$BASE_JVM_IMAGE" \
        -Dquarkus.openshift.namespace="$NS" \
        -Dquarkus.kubernetes.deploy=false \
        || fail "Maven/S2I build of $svc failed (oc get builds -n $NS; oc logs build/<name> -n $NS)"
done

step "Verifying ImageStream tags"
for svc in "${targets[@]}"; do
    ref="$(oc get istag "$svc:$IMAGE_TAG" -n "$NS" -o jsonpath='{.image.dockerImageReference}' 2>/dev/null)" \
        || fail "no ImageStream tag $svc:$IMAGE_TAG"
    ok "$svc:$IMAGE_TAG ${ref##*@}"
done
