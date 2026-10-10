---
title: "Live Retest Inventory"
description: "Every example, demo and script in the repository, grouped by how it runs, with the command, its prerequisites, rough duration and pass condition — for the live retest on Docker Engine, minikube and OpenShift Local."
render_with_liquid: false
---

**Written:** 2026-10-09, branch `feat/docker-newest-stable-crc`.
Versions under test: Camel 4.22.1, Quarkus 3.40.1, Spring Boot 4.1.1, Citrus
5.0.2, JDK 25; Docker Engine 29.x with the compose v2 plugin.

All commands run from the repository root. **One workshop and one local
cluster at a time**: the compose stack and the Citrus test stacks bind fixed
host ports (9092, 9094, 8090, 6379, 5432, 6650, 8080, 8081, 8013/8014, and
3000/3100/3200/9009/4317/4318/13133 with `--lgtm`), so nothing else may hold
them.

## Already run on this branch (do not repeat unless something changes)

- `mvn verify` (Citrus compose test stacks, fixed host ports) for 04–14, both
  runtimes, before the coordinator stopped compose use: 21 of 22 projects
  pass, 111 of 112 tests. The one failure, `14-consumer-patterns/quarkus`
  `SqlPollingConsumerTest`, was a read-once race on the row status; the
  assertion now polls (both runtimes) and needs one re-run.
- Single-container config checks, no stack: OTel Collector 0.162.0
  `validate`, Tempo 3.1.0 / Loki 3.7.8 / Mimir 3.2.2 started on the repo's
  configs, Pulsar 5.0.0 standalone healthy in 15 s, kafbat Kafka UI v1.5.0
  ready in 7 s, `docker build` of `examples/Containerfile` and both Appendix T
  Containerfiles.
- The dev stack (`scripts/setup-stack.sh`) was **not** started.

## Suggested order

1. Group A1 (stack up), A3 boot sweep, A4 demos, A5 scripts, B (JBang/CLI),
   then A1 down.
2. Group A2 (`mvn verify`, stack down) — the longest step.
3. Group C (minikube), then `--clean`.
4. Group D (OpenShift Local), ending with `teardown.sh`.

## A. Compose stack on Docker Engine

### A1. The stack itself

| Command | Needs first | Time | Pass |
|---|---|---|---|
| `./scripts/setup-stack.sh` | Docker daemon on context `default`; ports free | 3–5 min first pull, ~1 min after | exit 0; last line `==> All services up. Run your Camel examples against this stack.`; `docker ps` shows eip-kafka, eip-kafka-ui, eip-pulsar, eip-redis, eip-postgres, eip-apicurio, eip-flagd |
| `./scripts/setup-stack.sh --lgtm` | as above | +1–2 min | exit 0; `==> LGTM stack ready.`; `curl -sf localhost:13133/` and `curl -sf localhost:3000/api/health` return 200 |
| Chapter 0 checks: `docker exec eip-redis redis-cli ping` | A1 up | seconds | `PONG`; `docker exec eip-postgres psql -U eipuser -d eipdb -c '\dn'` lists orders, inventory, payments, shipping, notifications |
| `docker compose -p eip -f examples/_infra/compose.yaml -f examples/_infra/compose.lgtm.yaml down -v` | — | <1 min | exit 0; no `eip-*` containers or volumes left |

### A2. Integration tests (`mvn verify`, Citrus + Testcontainers compose)

Needs: Docker daemon; **the A1 stack down** (same ports). One command for all:

```bash
./scripts/build-all-examples.sh --with-tests        # ~2-3 h, sequential
./scripts/build-all-examples.sh --with-tests 15 16  # or a subset by name
```

Pass: the script ends `Passed: 61    Failed: 0`. Per project
(`mvn -B -ntp verify -f examples/<example>/<runtime>/pom.xml`), `BUILD SUCCESS`
with the test count below. Counts for 04–14 were observed on this branch; the
others are the counts the chapter footers recorded at the last full run and
are what to expect.

| Example | Runtimes | Tests per runtime | Time per runtime | Status on this branch |
|---|---|---|---|---|
| `04-channel-types` | quarkus, spring-boot | 8 | ~1.2 min | pass |
| `05-reliability` | quarkus, spring-boot | 2 | ~0.5 min | pass |
| `06-channel-infra` | quarkus, spring-boot | 3 | ~0.8 min | pass |
| `07-message-types` | quarkus, spring-boot | 3 | ~0.7 min | pass |
| `08-message-metadata` | quarkus, spring-boot | 6 | ~1.5 min | pass |
| `09-routing-fundamentals` | quarkus, spring-boot | 7 | ~1.2 min | pass |
| `10-composed-routing` | quarkus, spring-boot | 5 | ~1 min | pass |
| `11-advanced-routing` | quarkus, spring-boot | 5 | ~1 min | pass |
| `12-transformation` | quarkus, spring-boot | 3 | ~0.7 min | pass |
| `13-aggregator` | quarkus, spring-boot | 5 | ~1 min | pass |
| `14-consumer-patterns` | quarkus, spring-boot | 9 | ~1.5 min | spring-boot pass; quarkus 8/9 before the race fix — re-run |
| `15-endpoints` | quarkus, spring-boot | see chapter 15 footer | ~1.5 min | not run (compose stopped) |
| `16-endpoint-management` | quarkus, spring-boot | footer | ~1 min | not run |
| `17-observability` | quarkus, spring-boot | footer | ~1 min | not run |
| `18-testing-management` | quarkus, spring-boot | footer | ~1 min | not run |
| `20-kafka-deep-dive` | quarkus, spring-boot | footer | ~1 min | not run |
| `21-pulsar-deep-dive` | quarkus, spring-boot | footer | ~1 min | not run — first run on Pulsar 5.0.0 |
| `22-redis-integration` | quarkus, spring-boot | footer | ~1 min | not run |
| `24-drools-rules` | quarkus, spring-boot | footer | ~1.5 min | not run |
| `25-quarkus-flow` | single project | 3 | ~1 min | not run |
| `26-feature-flags` | quarkus, spring-boot | footer | ~1 min | not run — first run on flagd v0.17.0 |
| `27-observability-stack` | quarkus, spring-boot | 6 | ~1 min | not run |

Projects whose `mvn verify` starts no fixed-port stack (unit tests,
Dev Services on random ports, or no tests) were run on this branch; see the
results section of [`docker-newest-stable-crc.md`](docker-newest-stable-crc.md):
`19-dsl-comparison`, `23-quarkus-dev` (Dev Services, 2 tests),
`32-kafka-consumer-tuning`, `33-kafka-producer-tuning`,
`37-testing-strategies` (unit + integration, no containers),
`38-kubernetes-deploy`, `42-ai-mcp`, `bond-trading`, `loan-broker`,
`domain-model`. Several of these have **no tests**: `mvn verify` only proves
they build; the runtime proof is A3/A4.

### A3. Boot sweep

| Command | Needs first | Time | Pass |
|---|---|---|---|
| `./scripts/build-all-examples.sh` then `./scripts/verify-all-runtime.sh` | A1 base stack up; A2 not running | ~10 min | `Boots: 59    Fails: 0` (every `quarkus/` and `spring-boot/` jar starts) |

### A4. Runtime demos (examples with no tests, or whose chapter claims more than tests show)

All need the A1 base stack and a built jar. `scripts/verify-example-runtime.sh`
starts the jar, optionally POSTs, waits, and prints `RESULT: routes processed
messages` on success.

| Example | Command | Extra needs | Time | Pass |
|---|---|---|---|---|
| `19-dsl-comparison` | `SEED_TOPIC=eip.orders.placed SEED='{"order_id":"DSL-1","amount":640.00,"item_sku":"W-1"}' ./scripts/verify-example-runtime.sh 19-dsl-comparison quarkus` and `... spring-boot`; YAML: `SEED_TOPIC=eip.orders.placed SEED='{"order_id":"DSL-1","amount":640.00,"item_sku":"W-1"}' ./scripts/verify-jbang-example.sh 19-dsl-comparison/yaml-dsl 30` (consumer-only: each run needs fresh records, the runtimes share a consumer group) | Camel CLI 4.22.1 | ~1 min each | `RESULT: routes processed messages`; logs classify `amount > 500` as `HIGH_VALUE`, identical across runtimes |
| `26-feature-flags` | `./scripts/verify-example-runtime.sh 26-feature-flags quarkus 60` and `spring-boot` | flagd (in A1) | ~1.5 min each | `RESULT: routes processed messages`; detour enriches while `enrichment-enabled` is on; VIP/ENTERPRISE get `hazmat-compliance-v2` = `v2` |
| `27-observability-stack` | `./scripts/setup-stack.sh --lgtm`; `SEED_TOPIC=eip.orders.placed SEED=<five orders, as the chapter> ./scripts/verify-example-runtime.sh 27-observability-stack quarkus 60` and `spring-boot` | LGTM overlay | ~2 min each | `curl -s localhost:3200/api/search?limit=20` lists `eip.orders.placed` traces; `curl -s 'localhost:9009/prometheus/api/v1/query?query=camel_exchanges_total'` non-empty; Loki has route log lines |
| `32-kafka-consumer-tuning` | `./scripts/verify-example-runtime.sh 32-kafka-consumer-tuning quarkus 60` and `spring-boot` | — | ~1.5 min each | `RESULT: routes processed messages`, `error-lines=0` |
| `33-kafka-producer-tuning` | `./scripts/verify-example-runtime.sh 33-kafka-producer-tuning quarkus 60` and `spring-boot` | — | ~1.5 min each | `RESULT: routes processed messages`, `error-lines=0` |
| `loan-broker` | `./scripts/verify-example-runtime.sh loan-broker quarkus 60 http://localhost:8082/api/loans '{"customerId":"CUST-042","amount":250000,"termMonths":360,"creditScore":740}'`; Spring Boot URL `http://localhost:8082/camel/api/loans` | — | ~1.5 min each | `POST ... -> HTTP 202` with a requestId; log shows the lowest approved rate published to `loan.results` |
| `bond-trading` | `./scripts/verify-example-runtime.sh bond-trading quarkus 60` and `spring-boot` | — | ~1.5 min each | every stage logs traffic (three feeds, normalizer, distributor, three desks, validator), `error-lines=0` |
| `23-quarkus-dev` | `cd examples/23-quarkus-dev/quarkus && mvn quarkus:dev` | A1 **down** (Dev Services) | ~2 min | Dev Services Kafka on a random port; orders classified. **Interactive** (dev-mode console; quit with `q`) |
| `42-ai-mcp` | `mvn quarkus:dev` / `mvn spring-boot:run` in `examples/42-ai-mcp/<runtime>`, then `curl -X POST localhost:8088/api/orders/classify ...` | **Ollama** on the host with a tool-calling model (`qwen2.5:3b`) | ~5 min + model pull | classifier returns a model answer; assistant logs `Tool call — looking up order: ORD-002`. **Needs an external service**; not part of the compose stack |
| All Maven examples, by hand | `mvn quarkus:dev` / `mvn spring-boot:run` per example | A1 | — | Covered by A3 + A2; `quarkus:dev` is interactive |

### A5. Operational scripts (Kafka appendices)

| Script | Command | Needs first | Time | Pass |
|---|---|---|---|---|
| Share groups (App. P) | `./examples/34-kafka-share-groups/share-groups-demo.sh` | A1 | ~3 min | nine orders split 3/3/3; accepted/rejected do not reappear, released do; exit 0 |
| Diagnostics (App. Q) | `./examples/35-kafka-diagnostics/kafka-diagnostics.sh` (with `09-routing-fundamentals` running) | A1 + one example consuming | ~1 min | seven steps print; consumer groups listed `Stable`; zero under-replicated partitions |
| Connect offsets (App. R) | `docker compose -p eip -f examples/_infra/compose.yaml -f examples/36-kafka-connect-offsets/compose.connect.yaml up -d connect` then `./examples/36-kafka-connect-offsets/connect-offsets-demo.sh` | A1 | ~3 min | topic goes 10 → 20 records after the PATCH rewind; DELETE leaves no offsets; exit 0. Then `docker compose ... rm -sf connect` |

## B. JBang / Camel CLI only (no Maven project)

Needs the Camel CLI pinned (`jbang app install --name camel
org.apache.camel:camel-launcher:4.22.1`) and the A1 base stack.

| Example | Command | Time | Pass |
|---|---|---|---|
| `39-camel-cli` | `./scripts/verify-jbang-example.sh 39-camel-cli 40 http://localhost:8088/api/orders 'orderType: EXPRESS' '{"orderId":"ORD-9001","customerId":"C-500","item":"Wireless Headphones","quantity":2}'` | ~2 min | `POST ... -> HTTP 200`; `RESULT: routes ran clean`; order enriched from Redis |
| `40-camel-tui` | `./scripts/verify-jbang-example.sh 40-camel-tui 40` | ~2 min | `RESULT: routes ran clean`. The TUI itself (`camel tui`) is **interactive** and has no automated check |
| `41-citrus-testing` | `cd examples/41-citrus-testing && camel plugin add test && camel test run test/order-validation.citrus.it.yaml && camel test run test/order-http.citrus.it.yaml` | ~2 min | `✔ TEST SUCCESS` for both: the Kafka test starts its own broker (`camel: infra: run:`, random port) and checks the valid order on `eip.orders.validated` and three rejections with their `rejectionReason` header; the HTTP test runs `order-http-route.yaml` on port 8088 and checks the 200 and 400 answers. Kafka on a random port, so A1 may stay up; 8088 must be free |
| YAML DSL suites (10 dirs: 04, 06, 07, 08, 09, 11, 14, 15, 16, 17) | `jbang --main main.CitrusJBang org.citrusframework:citrus-jbang:5.0.2 run examples/<example>/yaml-dsl/test` (as `.github/workflows/tests.yml`) | ~2 min each | `TEST SUCCESS` for every test; fixed ports: A1 down; CI pins `citrus-jbang` 5.0.2; each suite's `citrus-application.properties` pins `citrus.camel.jbang.version=4.22.1` |
| YAML DSL routes (11 dirs incl. 19) | `cd examples/<example>/yaml-dsl && camel run * --max-seconds=30`, with `--port=8082` for 06 and 17 (as the chapters; `*` also loads `application.properties`) | ~1 min each | routes start (`Routes startup (total:N`), no ERROR lines before `is shutting down` (consumer-close interrupts at the `--max-seconds` stop are expected) |
| Chapter snippets | `./scripts/compile-chapter-snippets.sh` | ~1 min | `snippets with API errors: 0` (116 compile; run on this branch: pass) |
| Content gate | `./scripts/validate-content.py --catalog <camel-catalog-4.22.1.jar>` (`--links` for external links) | seconds (links: ~2 min) | `No findings.` (run on this branch: pass) |

## C. minikube (Appendix T)

Needs: no other local cluster (CRC stopped); Docker Engine on `default`;
minikube 1.39+, kubectl 1.36, Helm, jq; host port 30088 free. Not yet run.

| Step | Command | Time | Pass |
|---|---|---|---|
| Profile + Kafka + Redis | `./scripts/setup-minikube-stack.sh` | 5–8 min | exit 0; `==> Profile eip ready.`; `docker port eip` shows `127.0.0.1:30088`; `kubectl --context eip get kafka eip-kafka -n kafka` Ready |
| Quarkus variant | `./examples/38-kubernetes-deploy/deploy-minikube.sh quarkus` | 3–4 min | exit 0; `/q/health/ready -> 200`; `ORD-K8S-… enriched with customerName Global Freight Ltd`; `==> quarkus variant deployed and verified on eip` |
| Spring Boot variant | `./examples/38-kubernetes-deploy/deploy-minikube.sh spring-boot` | 3–4 min | same, with `/actuator/health/readiness -> 200` |
| Scaling | `kubectl --context eip scale deployment/eip-k8s-deploy --replicas=3` | 1 min | three pods Ready; logs show partitions reassigned across the group |
| Clean | `./scripts/setup-minikube-stack.sh --clean` (then `--delete` if wanted) | 2 min | exit 0; profile `eip` Stopped |

## D. OpenShift Local (Appendix Z)

Needs: CRC dedicated to this project (inventory `oc get sub,csv -A` first);
minikube stopped; `crc config set cpus 6 memory 20480 disk-size 80`
(8 / 24576 for the platform tier); `crc start`; `eval "$(crc oc-env)"`;
helm, jq, mvn, JDK 25. Not yet run; operator CSVs re-checked on the cluster
with `oc get packagemanifest` first.

| Step | Command | Time | Pass |
|---|---|---|---|
| Infra | `./openshift/install-infra.sh` | 5–10 min | `amqstreams.v3.2.1-14 Succeeded`; `Kafka eip Ready` |
| Build | `./openshift/build-images.sh` | 2–3 min | `eip-k8s-deploy:v1 sha256:…` |
| Deploy | `./openshift/deploy.sh` | 2–3 min | `all deployments rolled out`; pods show SCC `restricted-v2` |
| Platform (optional) | `./openshift/platform/install-platform.sh` | 10–15 min | ScaledObject Ready; Java agent injected; Grafana Route 200 |
| Evidence | `./openshift/capture-evidence.sh` | 2–5 min | exit 0; `no secrets in openshift/evidence/<date>`; project checks report the order enriched and on `eip.orders.enriched` |
| Teardown | `./openshift/teardown.sh` | 5–10 min | `CRC is clean`; `OpenShift Local stopped` |

## Cannot run headless

- `23-quarkus-dev` dev mode and any `mvn quarkus:dev` (interactive console).
- `camel tui` (Appendix V) — interactive terminal UI.
- Grafana dashboards (Appendix I, `--lgtm`) — browser; the API checks above
  stand in.
- `42-ai-mcp` — needs a local Ollama with a tool-calling model.
- OpenShift Local — needs a Red Hat pull secret (external credentials) and
  `crc start`; the web console login is the user's (`crc console --credentials`).
