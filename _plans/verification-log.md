---
render_with_liquid: false
---

# Verification log

Per-chapter verification-status footers moved here from the chapter bodies. The
reader-facing chapters now carry a `## Build, run, observe` section (the example's
real commands) instead; the run records stay here. The `plans` collection is
`output: false`, so this file is not published. Unless noted, each example-backed
chapter was verified on 2026-10-09 with both runtime variants building against
**Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1)** and their Citrus integration
tests passing against live containers on Docker Engine; per-chapter specifics and
the conceptual chapters' notes follow.

## Conceptual chapters (no runnable example; footer removed)
- **00-prerequisites**: `setup-stack.sh` (and `--lgtm`) bring every service healthy, `redis-cli ping` -> PONG, `init-schemas.sql` creates the five domain schemas, OTel Collector + Grafana answer 200. The SDKMAN install chain was last run on a clean fedora:44 container 2026-09-14 (not re-verified each run).
- **01-running-example**: the domain model and order flow are exercised by the routing-fundamentals example (14 Citrus tests). The Avro schema shown is illustrative; the examples serialize JSON.
- **02-integration-styles**: every Java snippet compiles against Camel 4.22.1; file/shared-database/RPI routes are illustrative, no runnable example.
- **03-messaging-systems**: conceptual; snippets compile; the channels it names are the topics the examples use.
- **30-appendix-glossary**: glossary reference, no example.
- **31-appendix-virtual-threads**: conceptual reference, no example.
- **43-appendix-security**: unverified prose from the Camel 4.21/4.22 upgrade guides; the one code-exercised item (`allowedSchemes`) is in examples/14-consumer-patterns. Treat specifics as a map to the upgrade guides.

## Example-backed chapters (verified 2026-10-09 unless noted)
- **04-channel-types** (examples/04-channel-types, Q/SB/YAML): 16 Citrus tests pass.
- **05-channel-reliability** (examples/05-reliability, Q/SB): 4 Citrus tests pass.
- **06-channel-infrastructure** (examples/06-channel-infra, Q/SB/YAML): 6 Citrus tests pass.
- **07-message-types** (examples/07-message-types, Q/SB/YAML): 6 Citrus tests pass.
- **08-message-metadata** (examples/08-message-metadata): 12 Citrus tests pass.
- **09-routing-fundamentals** (examples/09-routing-fundamentals): 14 Citrus tests pass. The 4.22 splitter options were run live 2026-09-15: `maxFailedRecords(5)` completes a 10-item batch with 3 bad items and aborts one with 8 bad at the fifth failure; `group(25)` splits 60 items into 25/25/10.
- **10-composed-routing** (examples/10-composed-routing, Q/SB): 8 Citrus tests pass.
- **11-advanced-routing** (examples/11-advanced-routing): 10 Citrus tests pass.
- **12-transformation-fundamentals** (examples/12-transformation, Q/SB): 6 Citrus tests pass.
- **13-structural-transformation** (examples/13-aggregator, Q/SB): 10 Citrus tests pass.
- **14-consumer-patterns** (examples/14-consumer-patterns): 18 Citrus tests pass; YAML DSL routes run clean (5 Citrus tests); the SQL Polling Consumer picks up a PLACED row from `eipdb` and marks it PROCESSING.
- **15-producer-patterns** (examples/15-endpoints): 10 Citrus tests pass; YAML DSL routes run clean.
- **16-endpoint-management** (examples/16-endpoint-management, Q/SB/YAML): 14 Citrus tests pass; YAML routes run clean.
- **17-observability** (examples/17-observability, Q/SB/YAML): 8 Citrus tests pass; YAML runs with `camel run * --port=8082`, Control Bus answers `GET /control/status/control-bus-status` 200.
- **18-testing-management** (examples/18-testing-management, Q/SB): 10 Citrus tests pass.
- **19-appendix-dsl-comparison** (examples/19-dsl-comparison, all three): each runtime classifies DSL-1 (amount 640) as HIGH_VALUE and DSL-2 as STANDARD.
- **20-appendix-kafka** (examples/20-kafka-deep-dive, Q/SB): 4 Citrus tests pass.
- **21-appendix-pulsar** (examples/21-pulsar-deep-dive, Q/SB): 8 Citrus tests pass against live Pulsar 5.0.0.
- **22-appendix-redis** (examples/22-redis-integration, Q/SB): 8 Citrus tests pass.
- **23-appendix-quarkus-dev** (examples/23-quarkus-dev, Quarkus only): 2 continuous tests pass with Dev Services starting Kafka on a random port; the packaged app boots.
- **24-appendix-drools** (examples/24-drools-rules, Q/SB): 8 Citrus tests pass.
- **25-appendix-quarkus-flow** (examples/25-quarkus-flow, Quarkus): 3 integration tests pass.
- **26-appendix-feature-flags** (examples/26-feature-flags, Q/SB): 10 Citrus tests pass against flagd v0.17.0; the fractional A/B split asserted exactly (order ids 1-10 split 9 legacy / 1 new).
- **27-appendix-observability** (examples/27-observability-stack, Q/SB, needs --lgtm): 6 Citrus tests pass; Tempo returns the routes' traces (10 from the Spring Boot run) and Mimir has `camel_exchanges_total`.
- **28-appendix-loan-broker** (examples/loan-broker, Q/SB): `POST /api/loans` (Quarkus) and `/camel/api/loans` (Spring Boot) return 202 with a request id; lowest approved rate published to `loan.results`. (Fixed a Spring Boot double-marshal that returned an empty HTTP 500; the camel-servlet gateway sits under `/camel`.)
- **29-appendix-bond-trading** (examples/bond-trading, Q/SB): all feeds, normalizer, distributor, three desks and validator log traffic with no errors. Rejected orders now route to `bond.orders.invalid` (an Invalid Message Channel, not a Dead Letter Channel), verified by injecting a negative quantity and negative limit price.
- **32-appendix-kafka-consumer-tuning** (examples/32-kafka-consumer-tuning, Q/SB): the throughput/safety-first/static-membership consumers process messages with no errors.
- **33-appendix-kafka-producer-tuning** (examples/33-kafka-producer-tuning, Q/SB): batched/compressed/idempotent/synchronous producers and their verifiers log traffic with no errors.
- **34-appendix-kafka-share-groups** (examples/34-kafka-share-groups, `share-groups-demo.sh`): nine orders split across three consumers against Kafka 4.3.1; accepted and rejected records do not reappear, released ones do.
- **35-appendix-kafka-diagnostics** (examples/35-kafka-diagnostics, `kafka-diagnostics.sh`): all seven steps run with 09-routing-fundamentals consuming; groups Stable, no under-replicated partitions.
- **36-appendix-kafka-connect-offsets** (examples/36-kafka-connect-offsets, `connect-offsets-demo.sh`): PATCH rewind takes the topic from 10 to 20 records; DELETE leaves no offsets.
- **37-appendix-testing-strategies** (examples/37-testing-strategies, Q/SB): 14 tests each (10 unit, 4 integration).
- **38-appendix-kubernetes-deploy** (examples/38-kubernetes-deploy, minikube): on a fresh profile (Docker Engine, docker driver, containerd, Kubernetes v1.36.5, Strimzi Ready), both variants deploy, report ready, enrich a test order with `Global Freight Ltd` from Redis; scaled to three replicas, all three pods take partitions.
- **39-appendix-camel-cli** (examples/39-camel-cli, Camel CLI YAML): `POST /api/orders` with `orderType: EXPRESS` returns 200; the enricher publishes ORD-9001 with customer Acme Freight, tier GOLD, from Redis.
- **40-appendix-camel-tui** (examples/40-camel-tui, Camel CLI YAML): the demo routes run clean; the TUI screens are described from use, not an automated check.
- **41-appendix-citrus-testing** (examples/41-citrus-testing, Citrus/Testcontainers): both tests pass through `camel test run` (the Kafka test with its own broker; the valid order and three rejections with their `rejectionReason` header; the HTTP test with 200/400 and extracted order id) and again in the project `camel export` generates (`mvn verify -DskipITs=false`).
- **42-appendix-ai-mcp** (examples/42-ai-mcp, Ollama 0.40.2 / qwen2.5:3b, Q/SB): the classifier returns JSON (lithium batteries HAZARDOUS, salmon PERISHABLE, glasses FRAGILE, t-shirts STANDARD); the assistant calls the `ai-tool` route for ORD-001/002/003/999 and answers from its data; an external MCP client lists and calls `order-status` over streamable HTTP at `/mcp` (Quarkus) and SSE (Spring Boot). This run fixed the classifier (its instructions went in a header the chat component never reads).
- **44-appendix-openshift-local** (openshift/ scripts): full cycle on OpenShift Local 4.22.14: AMQ Streams amqstreams.v3.2.1-14 Succeeded, Kafka Ready, in-cluster build pushed `eip-k8s-deploy:v1` on ubi10/openjdk-25:1.24-15, chart rolled out under restricted-v2, platform tier installed (KEDA scaler Ready, Java agent injected, Grafana Route up), secret scrub clean, teardown left CRC clean and stopped. Evidence: openshift/evidence/2026-10-09/.
