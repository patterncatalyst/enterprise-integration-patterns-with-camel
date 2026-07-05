---
title: "Examples"
order: 100
description: "Runnable Apache Camel examples for every pattern category, built with Quarkus and deployable on Podman."
---

Each pattern category has a corresponding set of runnable Quarkus projects under `examples/patterns/`. Every example:

- Uses **Apache Camel on Quarkus** with the shipping domain
- Runs against the local **Podman stack** (Kafka, Pulsar, Redis, PostgreSQL)
- Includes a **Containerfile** with multi-stage UBI9 builds
- Is instrumented with **OpenTelemetry** for end-to-end tracing

## Getting started

```bash
# Start the infrastructure stack
podman-compose -f examples/_infra/compose.yaml up -d

# Build and run a specific pattern example
cd examples/patterns/03-message-routing/content-based-router
mvn quarkus:dev
```

> **Examples are being built** — check the [GitHub repository](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel) for the latest progress.
