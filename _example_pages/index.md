---
title: "Examples"
order: 100
description: "Runnable Apache Camel Quarkus examples for every pattern category, built with the shipping domain on Podman."
---

Each pattern category has a corresponding runnable Quarkus project under `examples/`. Every example:

- Uses **Apache Camel on Quarkus** with the Java DSL and shipping domain
- Runs against the local **Podman stack** (Kafka, Pulsar, Redis, PostgreSQL)
- Includes a shared **Containerfile** with multi-stage UBI9 builds
- Can be started with a single command: `mvn quarkus:dev`

## Getting started

```bash
# Start the infrastructure stack
./scripts/setup-stack.sh

# Run a specific example
cd examples/09-routing-fundamentals
mvn quarkus:dev
```

## Pattern examples

| Example | Patterns | Chapter |
|---------|----------|---------|
| [05-reliability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/05-reliability) | Dead Letter Channel, Guaranteed Delivery | Ch 5 |
| [09-routing-fundamentals](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/09-routing-fundamentals) | Content-Based Router, Filter, Splitter, Recipient List | Ch 9 |
| [10-composed-routing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/10-composed-routing) | Scatter-Gather, Routing Slip | Ch 10 |
| [12-transformation](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/12-transformation) | Message Translator, Content Enricher, Content Filter | Ch 12 |
| [13-aggregator](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/13-aggregator) | Aggregator, Normalizer | Ch 13 |
| [15-endpoints](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/15-endpoints) | Idempotent Receiver, Service Activator | Ch 15 |
| [17-observability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/17-observability) | Control Bus, Wire Tap, Message History | Ch 17 |

## Case studies

| Example | Description | Appendix |
|---------|-------------|----------|
| [loan-broker](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/loan-broker) | Scatter-Gather — fan out to banks, aggregate best offer (13 EIP patterns) | Appendix J |
| [bond-trading](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/bond-trading) | Market data normalization, desk filtering, trade execution (16 EIP patterns) | Appendix K |

## Infrastructure

The shared Podman stack provides all backing services:

```bash
# Base stack: Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI
./scripts/setup-stack.sh

# With observability: Grafana, Loki, Tempo, Mimir, OTel Collector
./scripts/setup-stack.sh --lgtm
```

See [Prerequisites & Setup]({{ '/docs/00-prerequisites/' | relative_url }}) for full environment details.
