# Getting Started

Quick-start guide for running the EIP tutorial examples locally.

## Prerequisites

| Tool | Minimum | Install |
|------|---------|---------|
| Java | 25 (LTS) | `sdk install java 25.0.2-tem` ([SDKMAN](https://sdkman.io/)) |
| Maven | 3.9+ | `sdk install maven` |
| JBang | latest | `curl -Ls https://sh.jbang.dev \| bash -s - app setup` |
| Camel CLI | latest | `jbang app install camel@apache/camel` |
| Podman | 4.x+ | [podman.io](https://podman.io/) |
| Podman Compose | 1.x+ | `pip install podman-compose` |

For detailed installation instructions, see [Chapter 0 — Prerequisites & Setup](https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/docs/00-prerequisites/).

## 1. Clone the repo

```bash
gh repo clone patterncatalyst/enterprise-integration-patterns-with-camel
cd enterprise-integration-patterns-with-camel
```

## 2. Start the infrastructure stack

```bash
./scripts/setup-stack.sh
```

This starts Kafka (KRaft), Pulsar, Redis, PostgreSQL, and Apicurio Registry on Podman. To include the observability stack (Grafana, Loki, Tempo, Mimir):

```bash
./scripts/setup-stack.sh --lgtm
```

## 3. Run an example

Core examples (chapters 04, 09, 12) have `quarkus/` and `spring-boot/` subdirectories — choose your runtime:

```bash
# Quarkus (Dev Mode with live reload)
cd examples/09-routing-fundamentals/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/09-routing-fundamentals/spring-boot
mvn spring-boot:run
```

Quarkus Dev Mode starts with live reload — edit a route and the changes take effect immediately. Press `q` to stop. Spring Boot runs as a standard application; restart to pick up changes.

Other examples are currently Quarkus-only (Spring Boot variants are being added progressively).

## 4. Run all examples

The CI workflow builds every example with `mvn verify`. To do the same locally:

```bash
for dir in examples/*/; do
  [ -f "$dir/pom.xml" ] && (cd "$dir" && mvn verify -q) && echo "✓ $dir"
done
```

## Available examples

| # | Example | Patterns |
|---|---------|----------|
| 1 | `examples/04-channel-types` | Point-to-Point, Publish-Subscribe, Datatype Channel, Redis Pub/Sub |
| 2 | `examples/05-reliability` | Dead Letter Channel, Guaranteed Delivery |
| 3 | `examples/06-channel-infra` | Channel Adapter, Messaging Bridge, Message Bus |
| 4 | `examples/07-message-types` | Command, Document, Event Message |
| 5 | `examples/08-message-metadata` | Correlation ID, Message Sequence, Expiration, Format Indicator |
| 6 | `examples/09-routing-fundamentals` | Content-Based Router, Filter, Splitter, Recipient List |
| 7 | `examples/10-composed-routing` | Scatter-Gather, Routing Slip |
| 8 | `examples/11-advanced-routing` | Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, Load Balancer |
| 9 | `examples/12-transformation` | Message Translator, Content Enricher (Redis), Content Filter |
| 10 | `examples/13-aggregator` | Aggregator, Normalizer |
| 11 | `examples/14-consumer-patterns` | Polling Consumer, Event-Driven Consumer, Competing Consumers, Message Dispatcher |
| 12 | `examples/15-endpoints` | Idempotent Receiver, Service Activator |
| 13 | `examples/16-endpoint-management` | Messaging Gateway, Selective Consumer, Channel Purger, Messaging Mapper |
| 14 | `examples/17-observability` | Control Bus, Wire Tap, Message History |
| 15 | `examples/18-testing-management` | Test Message, Detour, Smart Proxy, Circuit Breaker |
| 16 | `examples/20-kafka-deep-dive` | Key-based partitioning, transactional pipeline, lag monitoring |
| 17 | `examples/21-pulsar-deep-dive` | Shared/Key_Shared subscriptions, dead letter topics |
| 18 | `examples/22-redis-integration` | Caching enrichment, idempotent receiver, distributed locking |
| 19 | `examples/24-drools-rules` | Rule-based content routing with Drools 10 rule units |
| 20 | `examples/25-quarkus-flow` | Order fulfillment saga with CDI state machine |
| 21 | `examples/27-observability-stack` | OpenTelemetry tracing, Micrometer metrics, health probes |
| 22 | `examples/32-kafka-consumer-tuning` | Throughput-tuned, safety-first, static-membership consumers |
| 23 | `examples/33-kafka-producer-tuning` | Batched, compressed, idempotent, synchronous producers |
| 24 | `examples/37-testing-strategies` | Three-tier testing: unit, integration, Newman |
| 25 | `examples/loan-broker` | Scatter-Gather case study (13 patterns) |
| 26 | `examples/bond-trading` | Market data normalization (16 patterns) |

## Tutorial site

The full tutorial is published at:
**https://patterncatalyst.github.io/enterprise-integration-patterns-with-camel/**

To build the site locally:

```bash
bundle install
bundle exec jekyll serve
```

## Presentations

Two PPTX decks are in `presentations/`:

- **EIP 101** (98 slides) — Conceptual guide to all 65 patterns
- **EIP 201** (126 slides) — Implementation deep-dive with Java DSL

To rebuild from source: `cd presentations/src && bash build.sh`
