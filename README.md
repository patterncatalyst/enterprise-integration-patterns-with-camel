# Enterprise Integration Patterns with Apache Camel

A comprehensive guide to the **65 Enterprise Integration Patterns** (Hohpe & Woolf) — implemented with Apache Camel on three runtimes (Quarkus, Spring Boot, and YAML DSL), backed by Kafka, Pulsar, and Redis, with runnable examples on Docker Engine.

**[Read the tutorial](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/)**

## What's inside

- **45 tutorial chapters** — 10 parts covering all 65 EIP patterns, from integration styles through system management, plus 26 deep-dive appendices.
- **68 Excalidraw diagrams** — visual architecture and pattern flow diagrams with EIP stencil icons embedded throughout.
- **37 runnable examples** — Camel projects (Quarkus and Spring Boot variants) you can build and run against a local Docker Compose stack, plus operational scripts for the Kafka appendices, including Loan Broker and Bond Trading case studies.
- **Shipping domain** — A consistent e-commerce scenario (orders, inventory, payments, shipping, notifications) that drives every pattern example.
- **Local infrastructure** — One-command compose stack with Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio Registry, and an optional LGTM observability overlay (Grafana, Loki, Tempo, Mimir).

## Prerequisites

Fedora or RHEL host (bare metal or VM).

| Tool | Version | Notes |
|------|---------|-------|
| JDK | 25 (Temurin 25.0.4 via SDKMAN) | `sdk install java 25.0.4-tem` |
| Maven | 3.9+ | `sdk install maven` |
| JBang + Camel CLI | JBang 0.142+, Camel CLI 4.22.1 | `jbang app install --name camel org.apache.camel:camel-launcher:4.22.1` |
| Docker Engine | 29.x (`docker-ce`) on the `default` context | Runs the compose stack and the Testcontainers-backed tests; no desktop app |
| Docker Compose | v2 plugin (`docker compose`) | Not the legacy `docker-compose` binary |
| minikube, kubectl, Helm | 1.39+, 1.36, 3.18+/4 | Optional: Appendix T (docker driver + containerd) |
| OpenShift Local (`crc`), `oc`, `jq` | crc 2.64+ | Optional: Appendix Z; no container engine needed |

Run one local cluster at a time.

## Quick start

```bash
# Clone
gh repo clone patterncatalyst/enterprise-integration-patterns-with-camel
cd enterprise-integration-patterns-with-camel

# Start the local stack
./scripts/setup-stack.sh

# Run a Quarkus example
cd examples/09-routing-fundamentals/quarkus
mvn quarkus:dev

# Or the Spring Boot variant
cd examples/09-routing-fundamentals/spring-boot
mvn spring-boot:run

# Start with observability (Grafana, Loki, Tempo, Mimir)
./scripts/setup-stack.sh --lgtm
```

Running the integration tests? Testcontainers uses the same Docker Engine as the
stack, on the default context — check the daemon answers first:

```bash
docker info >/dev/null && echo ok

# Tests bind the same ports as the dev stack, so stop it first
docker compose -p eip -f examples/_infra/compose.yaml down
./scripts/build-all-examples.sh --with-tests
```

See [Prerequisites & Setup](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/docs/00-prerequisites/) for full environment setup.

## Runnable examples

| Example | Patterns | Chapter |
|---------|----------|---------|
| `examples/04-channel-types` | Point-to-Point, Publish-Subscribe, Datatype Channel (Kafka + Pulsar + Redis Pub/Sub) | Ch 4 |
| `examples/05-reliability` | Dead Letter Channel, Guaranteed Delivery | Ch 5 |
| `examples/06-channel-infra` | Channel Adapter (REST→PostgreSQL→Kafka), Kafka↔Pulsar Bridge, Message Bus | Ch 6 |
| `examples/07-message-types` | Command, Document, Event Message | Ch 7 |
| `examples/08-message-metadata` | Correlation ID, Message Sequence, Expiration, Format Indicator | Ch 8 |
| `examples/09-routing-fundamentals` | Content-Based Router, Filter, Splitter, Recipient List | Ch 9 |
| `examples/10-composed-routing` | Scatter-Gather, Routing Slip | Ch 10 |
| `examples/11-advanced-routing` | Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, Load Balancer | Ch 11 |
| `examples/12-transformation` | Message Translator, Content Enricher (Redis), Content Filter | Ch 12 |
| `examples/13-aggregator` | Aggregator (in-memory + PostgreSQL JDBC), Normalizer | Ch 13 |
| `examples/14-consumer-patterns` | Polling Consumer (Kafka + PostgreSQL), Event-Driven Consumer (Kafka + Pulsar), Competing Consumers, Message Dispatcher | Ch 14 |
| `examples/15-endpoints` | Idempotent Receiver (JDBC), Outbox Pattern (PostgreSQL), Durable Subscriber (Pulsar), Service Activator | Ch 15 |
| `examples/16-endpoint-management` | Messaging Gateway, Selective Consumer, Channel Purger, Messaging Mapper | Ch 16 |
| `examples/17-observability` | Control Bus, Wire Tap, Message History, Message Store (PostgreSQL) | Ch 17 |
| `examples/18-testing-management` | Test Message, Detour, Smart Proxy, Circuit Breaker | Ch 18 |
| `examples/loan-broker` | Scatter-Gather case study (13 patterns) | Appendix J |
| `examples/19-dsl-comparison` | The same route on Quarkus, Spring Boot and the YAML DSL | Appendix A |
| `examples/20-kafka-deep-dive` | Key-based partitioning, transactional pipeline, consumer lag monitoring | Appendix B |
| `examples/21-pulsar-deep-dive` | Shared/Key_Shared subscriptions, dead letter topics | Appendix C |
| `examples/22-redis-integration` | Caching enrichment, idempotent receiver, distributed locking | Appendix D |
| `examples/23-quarkus-dev` | Dev Services, live reload, continuous testing (Quarkus-only by design) | Appendix E |
| `examples/24-drools-rules` | Rule-based content routing with Drools 10 rule units | Appendix F |
| `examples/27-observability-stack` | OpenTelemetry tracing, Micrometer metrics, health probes | Appendix I |
| `examples/25-quarkus-flow` | Order fulfillment saga with CDI state machine and Camel routes | Appendix G |
| `examples/26-feature-flags` | Flag-controlled Detour, fractional A/B routing, targeted rollout (OpenFeature + flagd) | Appendix H |
| `examples/34-kafka-share-groups` | KIP-932 share groups: fan-out beyond partition count, ACCEPT/RELEASE/REJECT | Appendix P |
| `examples/35-kafka-diagnostics` | The diagnostic workflow as a script: lag, group state, broker health, JVM dumps | Appendix Q |
| `examples/36-kafka-connect-offsets` | Listing, altering and resetting connector offsets over the Connect REST API | Appendix R |
| `examples/32-kafka-consumer-tuning` | Throughput-tuned, safety-first, and static-membership consumers | Appendix N |
| `examples/33-kafka-producer-tuning` | Batched, compressed, idempotent, and synchronous producers | Appendix O |
| `examples/37-testing-strategies` | Three-tier testing: unit (MockEndpoint), integration (REST Assured), Newman | Appendix S |
| `examples/38-kubernetes-deploy` | Containerfile builds and Kubernetes deployment on minikube (docker driver, containerd, Strimzi) | Appendix T |
| `openshift/` + `examples/38-kubernetes-deploy/quarkus` | The same pipeline on OpenShift Local: AMQ Streams, in-cluster S2I build, Helm chart under restricted-v2, edge-TLS Routes | Appendix Z |
| `examples/39-camel-cli` | CLI prototype-to-production workflow with content-based routing and Redis enrichment | Appendix U |
| `examples/40-camel-tui` | TUI dashboard demo with order validation, data generation, and multi-step processing | Appendix V |
| `examples/41-citrus-testing` | End-to-end integration testing with Citrus, Kafka, and HTTP validation | Appendix W |
| `examples/42-ai-mcp` | AI-powered order classification and assistant using Camel LangChain4j | Appendix X |
| `examples/bond-trading` | Market data normalization, desk filtering, trade validation (16 patterns) | Appendix K |

Examples with `quarkus/` and `spring-boot/` subdirectories support both runtimes. Ten examples also include a `yaml-dsl/` directory with standalone YAML routes for the Camel CLI. Run with `mvn quarkus:dev` (Quarkus), `mvn spring-boot:run` (Spring Boot), or `camel run *` (YAML DSL) against the infrastructure stack.

## Tutorial structure

| Part | Topic | Patterns |
|------|-------|----------|
| 0 | Getting Started | Prerequisites, the shipping domain |
| 1 | Integration Styles | File Transfer, Shared Database, RPI, Messaging |
| 2 | Messaging Systems | Channel, Message, Pipes & Filters, Router, Translator, Endpoint |
| 3 | Messaging Channels | Point-to-Point, Pub/Sub, Dead Letter, Guaranteed Delivery, and more |
| 4 | Message Construction | Command, Document, Event messages, Request-Reply, Correlation |
| 5 | Message Routing | Content-Based Router, Splitter, Aggregator, Scatter-Gather, and more |
| 6 | Message Transformation | Translator, Enricher, Content Filter, Normalizer, Canonical Model |
| 7 | Messaging Endpoints | Gateway, Consumers, Dispatcher, Idempotent Receiver, Service Activator |
| 8 | System Management | Control Bus, Wire Tap, Message History, Message Store |
| 9 | Appendices | Spring Boot vs Quarkus, Kafka, Pulsar, Redis, Quarkus Dev Mode, Drools, Quarkus Flow, Feature Flags, Observability, Kubernetes Deployment, OpenShift Local, Camel CLI, Camel TUI, Citrus Testing, AI and MCP, Secure by Default, Loan Broker & Bond Trading case studies, Glossary, Virtual Threads, Consumer/Producer Tuning, Share Groups, Diagnostics, Kafka Connect Offsets, Testing Strategies |

## Stack

| Component | Role |
|-----------|------|
| Apache Camel 4.22.1 | Integration framework (Java DSL) |
| Quarkus 3.40.1 LTS (Camel Quarkus 3.40.0) | Runtime (fast startup, Dev Services, native builds) |
| Spring Boot 4.1.1 | Runtime (Spring ecosystem, wide adoption) |
| Apache Kafka (KRaft) | Primary messaging backbone |
| Apache Pulsar | Multi-tenant messaging, geo-replication |
| Redis | Caching, idempotent repositories, Pub/Sub |
| PostgreSQL | Persistent storage, outbox pattern |
| Apicurio Registry | Avro/Protobuf schema registry |
| Grafana + Loki + Tempo + Mimir | Observability (optional LGTM overlay) |

## Presentations

Two slide decks in `presentations/`:

| Deck | Slides | Focus |
|------|--------|-------|
| **EIP 101** | 98 | Conceptual guide — all 65 patterns with diagrams |
| **EIP 201** | 126 | Implementation deep-dive — Java DSL, code, case studies |

## Getting started

See [GETTING-STARTED.md](GETTING-STARTED.md) for a quick-start guide, or [the tutorial site](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/) for the full walkthrough.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache 2.0](LICENSE)
