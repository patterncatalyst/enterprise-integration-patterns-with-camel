# Enterprise Integration Patterns with Apache Camel

A comprehensive guide to the **65 Enterprise Integration Patterns** (Hohpe & Woolf) — implemented with Apache Camel on Quarkus, backed by Kafka, Pulsar, and Redis, with runnable examples on Podman.

**[Read the tutorial](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/)**

## What's inside

- **Tutorial site** — 10 parts covering all 65 EIP patterns, from integration styles through system management, with diagrams and code examples in Java DSL, YAML DSL, and XML DSL.
- **Runnable examples** — Quarkus projects you can build and run against a local Podman stack.
- **Shipping domain** — A consistent e-commerce scenario (orders, inventory, payments, shipping, notifications) that drives every pattern example.
- **Local infrastructure** — One-command Podman stack with Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio Registry, and an optional LGTM observability overlay (Grafana, Loki, Tempo, Mimir).

## Stack

| Component | Version |
|-----------|---------|
| Apache Camel | 4.20.0 |
| Camel Quarkus | 3.36.0 |
| Quarkus | 3.36.x |
| Java | 21 (LTS) |
| Podman | 5.x |

## Quick start

```bash
# Clone
gh repo clone patterncatalyst/enterprise-integration-patterns-with-camel
cd enterprise-integration-patterns-with-camel

# Start the local stack
./scripts/setup-stack.sh

# Start with observability (Grafana, Loki, Tempo, Mimir)
./scripts/setup-stack.sh --lgtm
```

See [Prerequisites & Setup](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/docs/00-prerequisites/) for full environment setup.

## Tutorial structure

| Part | Topic | Patterns |
|------|-------|----------|
| 0 | Getting Started | Prerequisites, the shipping domain |
| 1 | Integration Styles | File Transfer, Shared Database, RPI, Messaging |
| 2 | Messaging Systems | Channel, Message, Pipes & Filters, Router, Translator, Endpoint |
| 3 | Messaging Channels | Point-to-Point, Pub/Sub, Dead Letter, Guaranteed Delivery, and more |
| 4 | Message Construction | Command, Document, Event messages, Request-Reply, Correlation |
| 5 | Message Routing | Content-Based Router, Splitter, Aggregator, Scatter-Gather, and more |
| 6 | Message Transformation | Translator, Enricher, Content Filter, Claim Check, Normalizer |
| 7 | Messaging Endpoints | Gateway, Consumers, Dispatcher, Idempotent Receiver, Service Activator |
| 8 | System Management | Control Bus, Wire Tap, Message History, Message Store |
| 9 | Deep-Dive Appendices | Kafka, Pulsar, Redis, Drools, observability, case studies |

## License

[Apache 2.0](LICENSE)
