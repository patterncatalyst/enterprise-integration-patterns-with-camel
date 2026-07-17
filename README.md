# Enterprise Integration Patterns with Apache Camel

A comprehensive guide to the **65 Enterprise Integration Patterns** (Hohpe & Woolf) — implemented with Apache Camel on Quarkus and Spring Boot, backed by Kafka, Pulsar, and Redis, with runnable examples on Podman.

**[Read the tutorial](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/)**

## What's inside

- **37 tutorial chapters** — 10 parts covering all 65 EIP patterns, from integration styles through system management, plus 18 deep-dive appendices.
- **62 Excalidraw diagrams** — visual architecture and pattern flow diagrams with EIP stencil icons embedded throughout.
- **26 runnable examples** — Camel projects (Quarkus and Spring Boot variants) you can build and run against a local Podman stack, including Loan Broker and Bond Trading case studies.
- **Shipping domain** — A consistent e-commerce scenario (orders, inventory, payments, shipping, notifications) that drives every pattern example.
- **Local infrastructure** — One-command Podman stack with Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio Registry, and an optional LGTM observability overlay (Grafana, Loki, Tempo, Mimir).

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
| `examples/20-kafka-deep-dive` | Key-based partitioning, transactional pipeline, consumer lag monitoring | Appendix B |
| `examples/21-pulsar-deep-dive` | Shared/Key_Shared subscriptions, dead letter topics | Appendix C |
| `examples/22-redis-integration` | Caching enrichment, idempotent receiver, distributed locking | Appendix D |
| `examples/24-drools-rules` | Rule-based content routing with Drools 10 rule units | Appendix F |
| `examples/27-observability-stack` | OpenTelemetry tracing, Micrometer metrics, health probes | Appendix I |
| `examples/25-quarkus-flow` | Order fulfillment saga with CDI state machine and Camel routes | Appendix G |
| `examples/32-kafka-consumer-tuning` | Throughput-tuned, safety-first, and static-membership consumers | Appendix N |
| `examples/33-kafka-producer-tuning` | Batched, compressed, idempotent, and synchronous producers | Appendix O |
| `examples/37-testing-strategies` | Three-tier testing: unit (MockEndpoint), integration (REST Assured), Newman | Appendix S |
| `examples/bond-trading` | Market data normalization, desk filtering, trade validation (16 patterns) | Appendix K |

Examples with `quarkus/` and `spring-boot/` subdirectories support both runtimes. Run with `mvn quarkus:dev` (Quarkus) or `mvn spring-boot:run` (Spring Boot) against the infrastructure stack.

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
| 9 | Appendices | Spring Boot vs Quarkus, Kafka, Pulsar, Redis, Quarkus Flow, Drools, Observability, Loan Broker & Bond Trading case studies, Glossary, Virtual Threads, Consumer/Producer Tuning, Share Groups, Diagnostics, Kafka Connect Offsets, Testing Strategies |

## Stack

| Component | Role |
|-----------|------|
| Apache Camel 4.x | Integration framework (Java DSL) |
| Quarkus 3.x | Runtime (fast startup, Dev Services, native builds) |
| Spring Boot 4.x | Runtime (Spring ecosystem, wide adoption) |
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
