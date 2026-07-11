# Getting Started

Quick-start guide for running the EIP tutorial examples locally.

## Prerequisites

| Tool | Minimum | Install |
|------|---------|---------|
| Java | 21 (LTS) | `sdk install java 21.0.7-tem` ([SDKMAN](https://sdkman.io/)) |
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

Each example is a self-contained Camel Quarkus project:

```bash
cd examples/09-routing-fundamentals
mvn quarkus:dev
```

Quarkus Dev Mode starts with live reload — edit a route and the changes take effect immediately. Press `q` to stop.

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
| 1 | `examples/05-reliability` | Dead Letter Channel, Guaranteed Delivery |
| 2 | `examples/09-routing-fundamentals` | Content-Based Router, Filter, Splitter, Recipient List |
| 3 | `examples/10-composed-routing` | Scatter-Gather, Routing Slip |
| 4 | `examples/12-transformation` | Message Translator, Content Enricher, Content Filter |
| 5 | `examples/13-aggregator` | Aggregator, Normalizer |
| 6 | `examples/15-endpoints` | Idempotent Receiver, Service Activator |
| 7 | `examples/17-observability` | Control Bus, Wire Tap, Message History |
| 8 | `examples/loan-broker` | Scatter-Gather case study (13 patterns) |
| 9 | `examples/bond-trading` | Market data normalization (16 patterns) |

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
- **EIP 201** (135 slides) — Implementation deep-dive with Java DSL

To rebuild from source: `cd presentations/src && bash build.sh`
