---
title: "Docker Engine, Newest Stable, OpenShift Local"
description: "Decisions and outcome of the 2026-10-09 iteration: Podman replaced by Docker Engine, every pin moved to the newest stable release, the minikube path reworked, and an OpenShift Local appendix added."
render_with_liquid: false
---

**Branch:** `feat/docker-newest-stable-crc` (from `main` 983e4c6) · **Opened:** 2026-10-09
**Live retests:** see [`live-retest-inventory.md`](live-retest-inventory.md).

## 2026-10-09 — user decisions (binding)

1. **Docker, not Podman.** Containers run on Docker Engine (`docker-ce`,
   context `default`) with the `docker compose` v2 plugin. Podman,
   podman-compose and Podman Desktop are gone from docs, scripts and compose
   files; Containerfiles keep their name and build with
   `docker build -f Containerfile`. No desktop app is required. Fedora and
   RHEL hosts only. minikube runs `--driver=docker
   --container-runtime=containerd`, publishes NodePorts on 127.0.0.1 at
   profile creation, never uses port-forward, tunnels or `minikube service`,
   loads images with `minikube image load`, names its target on every call,
   and never runs `minikube config set`. Host port 9090 belongs to Cockpit
   (nothing here used it).
2. **Newest stable versions, pinned exactly**, checked upstream (sources
   below), with breaking changes fixed.
3. **OpenShift Local appendix** (Appendix Z) and an `openshift/` folder from
   the lgtm-crc templates, proportionate to what the tutorial teaches: Kafka
   via AMQ Streams, in-cluster S2I, a restricted-v2 chart with edge-TLS
   Routes, KEDA and tracing opt-in; no mesh, GitOps, AI or native. Marked
   not yet verified on a cluster.

## Versions and where they were checked

| Component | Was | Now | Source |
|---|---|---|---|
| Quarkus platform | 3.39.3 | **3.40.1** (LTS) | repo1 `io/quarkus/platform/quarkus-bom/maven-metadata.xml` |
| Camel Quarkus / Camel | 3.39.0 / 4.22.0 | **3.40.0 / 4.22.1** | `quarkus-camel-bom-3.40.1.pom` pins `camel-quarkus-core` 3.40.0, `camel-api` 4.22.1 |
| Camel Spring Boot | 4.22.0 | **4.22.1** | `camel-spring-boot-bom` metadata; `camel-parent-4.22.1` pins Spring Boot 4.1.1 |
| Spring Boot | 4.1.1 | 4.1.1 (newest) | `spring-boot-starter-parent` metadata |
| Camel CLI | `camel@apache/camel` alias | **`camel-launcher` 4.22.1** | `camel-launcher` metadata |
| Camel MCP server | alias | **`camel-jbang-mcp` 4.22.1** | `camel-jbang-mcp` metadata |
| quarkus-langchain4j | 1.7.4 (standalone BOM) | **1.13.3** via `io.quarkus.platform:quarkus-langchain4j-bom:3.40.1` | platform BOM |
| langchain4j-ollama (Spring Boot) | 1.20.0 | **1.22.0** | `dev/langchain4j/langchain4j-ollama` metadata |
| Citrus | 5.0.1 | **5.0.2** | `citrus-api` metadata |
| Surefire / Failsafe | 3.5.6 / 3.5.2 | **3.6.0** | plugin metadata |
| exec-maven-plugin | 3.5.0 | **3.6.4** | metadata |
| REST Assured (37 Spring Boot) | 5.5.1 | **6.1.0** | metadata |
| OTel instrumentation BOM | 2.31.1 | **2.32.0** | metadata |
| OpenFeature SDK / flagd provider | 1.22.1 / 0.14.2 | **1.23.0** / 0.14.2 | metadata |
| jackson-annotations (domain-model) | 2.18.2 | **2.22** | metadata (major.minor only since 2.20) |
| Drools | 10.2.0 | 10.2.0 (newest) | `drools-bom` metadata |
| JDK | 25 | 25 (Temurin 25.0.4 via SDKMAN) | Adoptium API, SDKMAN candidates |
| UBI images | `ubi9/openjdk-25:latest` | **`ubi10/openjdk-25[-runtime]:1.24-15`** | `skopeo list-tags` |
| Kafka | 4.3.1 | 4.3.1 (newest) | `skopeo list-tags docker://docker.io/apache/kafka` |
| Pulsar | 4.2.4 | **5.0.0** | `gh release list -R apache/pulsar` (5.0.0 GA 2026-10-05) |
| PostgreSQL | 18.6-alpine | 18.6-alpine (newest) | skopeo |
| Redis | 8.10.1-alpine | **8.10.2-alpine** | skopeo |
| Apicurio Registry | 3.3.3 | 3.3.3 (newest) | skopeo |
| flagd | v0.16.3 | **v0.17.0** | skopeo; breaking note is a metric rename only |
| Kafka UI | `provectuslabs/kafka-ui:v0.7.2` (unmaintained) | **`ghcr.io/kafbat/kafka-ui:v1.5.0`** | skopeo; same env contract, ready in 7 s |
| Grafana / Loki / Tempo / Mimir | 13.2.1 / 3.7.7 / 3.0.3 / 3.2.1 | **13.2.3 / 3.7.8 / 3.1.0 / 3.2.2** | skopeo; each config started clean on the new image |
| OTel Collector | 0.160.0 | **0.162.0** | skopeo; `otelcol-contrib validate` passes |
| minikube / Kubernetes / kubectl | 1.34+ / unpinned / 1.30+ | **1.39.0 / v1.36.5 / 1.36.5** | `gh release list`, lgtm-minikube-stack pin table |
| Strimzi | unpinned chart, `v1beta2`, ZooKeeper, Kafka 3.9.0 | **1.2.0**, `kafka.strimzi.io/v1`, KRaft, Kafka 4.3.1 | `helm show chart oci://quay.io/strimzi-helm/strimzi-kafka-operator --version 1.2.0`, release notes |
| Redis on minikube | Bitnami chart (unpinned) | official image Deployment | — |
| AMQ Streams (CRC) | — | `amqstreams.v3.2.1-14`, `amq-streams-3.2.x`, Kafka 4.2.0 | lgtm-crc versions.md (2026-10-09); re-check on the cluster |
| Custom Metrics Autoscaler (CRC) | — | `custom-metrics-autoscaler.v2.19.0-4` | same |
| Red Hat build of OpenTelemetry (CRC) | — | `opentelemetry-operator.v0.158.0-2` | same |
| otel-lgtm (CRC) | — | **0.36.0** | skopeo |

Quarkus 3.40's migration guide lists no manual changes after 3.39.

## Breaking changes found and fixed

| Change | Symptom | Fix |
|---|---|---|
| jackson-annotations versioned `2.22`, not `2.22.3` | `domain-model` failed dependency resolution | `jackson-annotations.version=2.22` |
| Quarkus test bootstrap downloads inside surefire | First `mvn verify` after the bump hung forever in 04 (thread dump: transfer listener blocked on the Quarkus test class loader) | `-ntp` in `build-all-examples.sh` |
| `quarkus.kubernetes.env-vars.<NAME>.value` ignored | Generated manifest had no `KAFKA_BROKERS`; the pod would have used `localhost:9092` (pre-existing) | `quarkus.kubernetes.env.vars.kafka-brokers` |
| Strimzi 1.x serves only `v1` | Appendix T's `v1beta2` + ZooKeeper CR cannot apply | `KafkaNodePool` + `Kafka` on `v1`, Kafka 4.3.1 |
| containerd in the minikube node | `minikube docker-env` has no daemon to point at | `docker build` + `minikube image load` |
| Shared Containerfile default `PROJECT=09-routing-fundamentals` | No pom at that path (pre-existing) | `PROJECT=09-routing-fundamentals/quarkus`, UBI 10 tags |
| Podman-only `devices: /dev/null` mapping | Meaningless on Docker | Removed from every compose file |
| `SqlPollingConsumerTest` read the row status once | 14-consumer-patterns Quarkus failed 1 of 9 on Docker Engine: the poller's `PROCESSING` update can land after the Kafka record is received | the assertion polls (`repeatOnError().times(10)`), both runtimes; re-run pending |

## Results (2026-10-09)

**Compile:** `./scripts/build-all-examples.sh` — 61/61 projects build
(after the jackson-annotations fix).

**`mvn verify`:** 39 of 61 projects run, 38 pass, 141 of 142 tests pass.

- With Citrus compose test stacks (fixed host ports), 04–14 both runtimes:
  21/22 projects, 111/112 tests. 04: 8+8, 05: 2+2, 06: 3+3, 07: 3+3,
  08: 6+6, 09: 7+7, 10: 5+5, 11: 5+5, 12: 3+3, 13: 5+5, 14: 9+9 with one
  Quarkus error (the race above, fixed in the test, not yet re-run).
- Stopped there at the coordinator's request: those stacks bind fixed host
  ports and collided with another workshop's live retest on the same host.
  15–18, 20–22, 24–27 (both runtimes) and 25-quarkus-flow are not run on
  this branch; their chapter footers are marked unverified.
- Without fixed-port stacks: 19, 23 (2 tests, Dev Services), 32, 33,
  37 (14 + 14), 38, 42, bond-trading, loan-broker, domain-model — 18/18
  projects, 30/30 tests.

**Other checks:** `validate-content.py` (4.22.1 catalog) no findings before
every commit; `compile-chapter-snippets.sh` 116/116; Jekyll build clean
(ruby 3.3 container); `bash -n` and ShellCheck 0.11 (`-S warning`) clean on
every new or changed script; `helm lint` and `helm template` of
`openshift/helm/eip` clean with both platform flags; `mvn package -Popenshift`
generates the BuildConfig and ImageStreams; both Appendix T images build; the
Quarkus manifest generates with NodePort 30088 and the right env.

**Footers:** 04–13 and 37 re-verified with the new versions; 01–03 updated;
every chapter whose evidence was a live run (00, 19, 23, 26–29, 32–36,
39–42) or whose tests did not run here (14–18, 20–22, 24, 25) is marked
unverified, keeping its earlier evidence as history. 38 and 44 are
unverified until a cluster run.

**Outstanding:** everything in [`live-retest-inventory.md`](live-retest-inventory.md)
not marked as run — the compose stack and demos, the remaining `mvn verify`
projects, minikube, and OpenShift Local.
