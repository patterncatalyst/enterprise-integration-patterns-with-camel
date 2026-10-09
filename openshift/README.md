# OpenShift Local (CRC)

Runs the Appendix T pipeline (`examples/38-kubernetes-deploy/quarkus`) on
OpenShift Local. The walkthrough is
[Appendix Z](../_docs/44-appendix-openshift-local.md).

```bash
minikube stop -p eip                        # one local cluster at a time
crc config set cpus 6; crc config set memory 20480; crc config set disk-size 80
crc start; eval "$(crc oc-env)"

./openshift/install-infra.sh                # project eip + AMQ Streams (pinned CSV) + Kafka
./openshift/build-images.sh                 # binary S2I build in the cluster
./openshift/deploy.sh                       # Helm chart: app, Redis, edge-TLS Route
./openshift/platform/install-platform.sh    # optional: KEDA + OpenTelemetry (8 vCPU / 24 GiB)
./openshift/capture-evidence.sh             # writes openshift/evidence/<date>/
./openshift/teardown.sh                     # always: remove everything, then crc stop
```

| Path | What |
|------|------|
| `lib.sh` | `require_crc` (crc-admin context, `api.crc.testing` only), pinned `install_operator`, `service_dir` |
| `infra/` | AMQ Streams Subscription (Manual approval, `startingCSV`) and the Kafka CR (`kafka.strimzi.io/v1`) |
| `helm/eip/` | Chart for `restricted-v2`: services, Redis, Routes; flags `keda`, `observability` |
| `platform/` | Custom Metrics Autoscaler and Red Hat build of OpenTelemetry (opt-in) |
| `project-checks.sh` | The end-to-end order check run by `capture-evidence.sh` |
| `evidence/` | Captured output, scrubbed for secrets |

Scaffolded from the `lgtm-crc` skill templates. Status: not yet verified on a
cluster.
