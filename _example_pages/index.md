---
title: "Examples"
permalink: /examples/
order: 100
description: "Runnable Apache Camel Quarkus examples for every pattern category, built with the shipping domain on Docker Engine."
---

Each pattern category has a corresponding runnable Quarkus project under `examples/`. Every example:

- Uses **Apache Camel on Quarkus** with the Java DSL and shipping domain
- Runs against the local **compose stack** (Kafka, Pulsar, Redis, PostgreSQL)
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
| [04-channel-types](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/04-channel-types) | Point-to-Point, Publish-Subscribe, Datatype Channel, Redis Pub/Sub | Kafka + Pulsar + Redis | Ch 4 |
| [05-reliability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/05-reliability) | Dead Letter Channel, Guaranteed Delivery | Kafka | Ch 5 |
| [06-channel-infra](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/06-channel-infra) | Channel Adapter, Messaging Bridge, Message Bus | Kafka + Pulsar + PostgreSQL | Ch 6 |
| [07-message-types](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/07-message-types) | Command, Document, Event Message | Kafka | Ch 7 |
| [08-message-metadata](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/08-message-metadata) | Correlation ID, Message Sequence, Expiration, Format Indicator | Kafka | Ch 8 |
| [09-routing-fundamentals](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/09-routing-fundamentals) | Content-Based Router, Filter, Splitter, Recipient List | Kafka | Ch 9 |
| [10-composed-routing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/10-composed-routing) | Scatter-Gather, Routing Slip | Kafka | Ch 10 |
| [11-advanced-routing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/11-advanced-routing) | Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, Load Balancer | Kafka | Ch 11 |
| [12-transformation](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/12-transformation) | Message Translator, Content Enricher (Redis), Content Filter | Kafka + Redis | Ch 12 |
| [13-aggregator](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/13-aggregator) | Aggregator (in-memory + PostgreSQL JDBC), Normalizer | Kafka + PostgreSQL | Ch 13 |
| [14-consumer-patterns](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/14-consumer-patterns) | Polling Consumer (Kafka + PostgreSQL), Event-Driven Consumer (Kafka + Pulsar), Competing Consumers, Message Dispatcher | Kafka + Pulsar + PostgreSQL | Ch 14 |
| [15-endpoints](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/15-endpoints) | Idempotent Receiver (JDBC), Outbox Pattern (PostgreSQL), Durable Subscriber (Pulsar), Service Activator | Kafka + Pulsar + PostgreSQL | Ch 15 |
| [16-endpoint-management](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/16-endpoint-management) | Messaging Gateway, Selective Consumer, Channel Purger, Messaging Mapper | Kafka | Ch 16 |
| [17-observability](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/17-observability) | Control Bus, Wire Tap, Message History, Message Store (PostgreSQL) | Kafka + PostgreSQL | Ch 17 |
| [18-testing-management](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/18-testing-management) | Test Message, Detour, Smart Proxy, Circuit Breaker | Kafka | Ch 18 |

## Appendix examples

| Example | Patterns | Infrastructure | Appendix |
|---------|----------|----------------|----------|
| [19-dsl-comparison](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/19-dsl-comparison) | The same route on Quarkus, Spring Boot and the YAML DSL | Kafka | Appendix A |
| [20-kafka-deep-dive](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/20-kafka-deep-dive) | Key-based partitioning, transactional pipeline, consumer lag monitoring | Kafka | Appendix B |
| [21-pulsar-deep-dive](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/21-pulsar-deep-dive) | Shared/Key_Shared subscriptions, dead letter topics | Pulsar | Appendix C |
| [22-redis-integration](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/22-redis-integration) | Caching enrichment, idempotent receiver, distributed locking | Kafka + Redis | Appendix D |
| [23-quarkus-dev](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/23-quarkus-dev) | Dev Services, live reload, continuous testing | None (Dev Services) | Appendix E |
| [24-drools-rules](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/24-drools-rules) | Rule-based content routing with Drools 10 rule units | Kafka | Appendix F |
| [25-quarkus-flow](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/25-quarkus-flow) | Order fulfillment saga with CDI state machine and Camel routes | Kafka | Appendix G |
| [26-feature-flags](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/26-feature-flags) | Flag-controlled Detour, fractional A/B routing, targeted rollout | Kafka + flagd | Appendix H |
| [27-observability-stack](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/27-observability-stack) | OpenTelemetry tracing, Micrometer metrics, health probes | Kafka (LGTM optional) | Appendix I |
| [32-kafka-consumer-tuning](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/32-kafka-consumer-tuning) | Throughput-tuned, safety-first, and static-membership consumers | Kafka | Appendix N |
| [33-kafka-producer-tuning](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/33-kafka-producer-tuning) | Batched, compressed, idempotent, and synchronous producers | Kafka | Appendix O |
| [34-kafka-share-groups](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/34-kafka-share-groups) | KIP-932 share groups: fan-out beyond partition count, ACCEPT/RELEASE/REJECT | Kafka | Appendix P |
| [35-kafka-diagnostics](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/35-kafka-diagnostics) | The diagnostic workflow as a script: lag, group state, broker health, JVM dumps | Kafka | Appendix Q |
| [36-kafka-connect-offsets](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/36-kafka-connect-offsets) | Listing, altering and resetting connector offsets over the REST API | Kafka + Connect | Appendix R |
| [37-testing-strategies](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/37-testing-strategies) | Three-tier testing: unit (MockEndpoint), integration (REST Assured), Newman | None (self-contained) | Appendix S |

| [38-kubernetes-deploy](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/38-kubernetes-deploy) | Container builds and Kubernetes deployment with Strimzi Kafka | Minikube | Appendix T |
| [39-camel-cli](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/39-camel-cli) | CLI prototype-to-production workflow (YAML DSL, no Maven) | Kafka + Redis | Appendix U |
| [40-camel-tui](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/40-camel-tui) | TUI dashboard demo with order validation (YAML DSL) | Kafka | Appendix V |
| [41-citrus-testing](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/41-citrus-testing) | End-to-end integration testing with Citrus (YAML DSL) | Testcontainers | Appendix W |
| [42-ai-mcp](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/42-ai-mcp) | AI order classification and assistant with LangChain4j | Kafka + Ollama | Appendix X |
## Case studies

| Example | Description | Appendix |
|---------|-------------|----------|
| [loan-broker](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/loan-broker) | Scatter-Gather — fan out to banks, aggregate best offer (13 EIP patterns) | Appendix J |
| [bond-trading](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/bond-trading) | Market data normalization, desk filtering, trade execution (16 EIP patterns) | Appendix K |

## Infrastructure

The shared compose stack provides all backing services:

```bash
# Base stack: Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI
./scripts/setup-stack.sh

# With observability: Grafana, Loki, Tempo, Mimir, OTel Collector
./scripts/setup-stack.sh --lgtm
```

See [Prerequisites & Setup]({{ '/docs/00-prerequisites/' | relative_url }}) for full environment details.
