---
title: "Examples"
permalink: /examples/
order: 100
description: "Runnable Apache Camel Quarkus examples for every pattern category, built with the shipping domain on Podman."
---

Each pattern category has a corresponding runnable Quarkus project under `examples/`. Every example:

- Uses **Apache Camel on Quarkus** with the Java DSL and shipping domain
- Runs against the local **Podman stack** (Kafka, Pulsar, Redis, PostgreSQL)
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

| Example | Patterns | Infrastructure | Chapter |
|---------|----------|----------------|---------|
| [04-channel-types](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/04-channel-types) | Point-to-Point, Publish-Subscribe, Datatype Channel | Kafka + Pulsar | Ch 4 |
| [05-reliability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/05-reliability) | Dead Letter Channel, Guaranteed Delivery | Kafka | Ch 5 |
| [06-channel-infra](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/06-channel-infra) | Channel Adapter, Messaging Bridge, Message Bus | Kafka + Pulsar + PostgreSQL | Ch 6 |
| [07-message-types](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/07-message-types) | Command, Document, Event Message | Kafka | Ch 7 |
| [08-message-metadata](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/08-message-metadata) | Correlation ID, Message Sequence, Expiration, Format Indicator | Kafka | Ch 8 |
| [09-routing-fundamentals](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/09-routing-fundamentals) | Content-Based Router, Filter, Splitter, Recipient List | Kafka | Ch 9 |
| [10-composed-routing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/10-composed-routing) | Scatter-Gather, Routing Slip | Kafka | Ch 10 |
| [11-advanced-routing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/11-advanced-routing) | Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, Load Balancer | Kafka | Ch 11 |
| [12-transformation](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/12-transformation) | Message Translator, Content Enricher, Content Filter | Kafka | Ch 12 |
| [13-aggregator](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/13-aggregator) | Aggregator (in-memory + PostgreSQL JDBC), Normalizer | Kafka + PostgreSQL | Ch 13 |
| [14-consumer-patterns](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/14-consumer-patterns) | Polling Consumer (Kafka + PostgreSQL), Event-Driven Consumer (Kafka + Pulsar), Competing Consumers, Message Dispatcher | Kafka + Pulsar + PostgreSQL | Ch 14 |
| [15-endpoints](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/15-endpoints) | Idempotent Receiver (JDBC), Outbox Pattern (PostgreSQL), Durable Subscriber (Pulsar), Service Activator | Kafka + Pulsar + PostgreSQL | Ch 15 |
| [16-endpoint-management](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/16-endpoint-management) | Messaging Gateway, Selective Consumer, Channel Purger, Messaging Mapper | Kafka | Ch 16 |
| [17-observability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/17-observability) | Control Bus, Wire Tap, Message History, Message Store (PostgreSQL) | Kafka + PostgreSQL | Ch 17 |
| [18-testing-management](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/18-testing-management) | Test Message, Detour, Smart Proxy, Circuit Breaker | Kafka | Ch 18 |

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
