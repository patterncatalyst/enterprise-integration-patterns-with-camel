# Enterprise Integration Patterns with Apache Camel

A comprehensive guide to the **65 Enterprise Integration Patterns** (Hohpe & Woolf) — implemented with Apache Camel on Quarkus, backed by Kafka, Pulsar, and Redis, with runnable examples on Podman.

**[Read the tutorial](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/)**

## What's inside

- **31 tutorial chapters** — 10 parts covering all 65 EIP patterns, from integration styles through system management, plus 12 deep-dive appendices.
- **26 Excalidraw diagrams** — visual architecture and pattern flow diagrams embedded throughout.
- **17 runnable examples** — Camel Quarkus projects you can build and run against a local Podman stack, including Loan Broker and Bond Trading case studies.
- **Shipping domain** — A consistent e-commerce scenario (orders, inventory, payments, shipping, notifications) that drives every pattern example.
- **Local infrastructure** — One-command Podman stack with Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio Registry, and an optional LGTM observability overlay (Grafana, Loki, Tempo, Mimir).

## Quick start

```bash
# Clone
gh repo clone patterncatalyst/enterprise-integration-patterns-with-camel
cd enterprise-integration-patterns-with-camel

# Start the local stack
./scripts/setup-stack.sh

# Run a Camel Quarkus example
cd examples/09-routing-fundamentals
mvn quarkus:dev

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
| `examples/bond-trading` | Market data normalization, desk filtering, trade validation (16 patterns) | Appendix K |

Each example runs with `mvn quarkus:dev` against the infrastructure stack.

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
| 9 | Appendices | Spring Boot vs Quarkus, Kafka, Pulsar, Redis, Drools, Observability, Case Studies, Glossary |

## Stack

| Component | Role |
|-----------|------|
| Apache Camel 4.x | Integration framework (Java DSL) |
| Quarkus 3.x | Runtime (fast startup, Dev Services, native builds) |
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
| **EIP 201** | 135 | Implementation deep-dive — Java DSL, code, case studies |

## Getting started

See [GETTING-STARTED.md](GETTING-STARTED.md) for a quick-start guide, or [the tutorial site](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/) for the full walkthrough.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache 2.0](LICENSE)
