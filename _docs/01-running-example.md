---
title: "The Running Example"
order: 1
part: "getting-started"
description: "The shipping domain — orders, inventory, payments, shipments, and notifications — that drives every pattern example."
duration: "20 minutes"
---

Every pattern in this tutorial is demonstrated using a **shipping domain** — the same domain used across the patterncatalyst project family. Five microservices collaborate through messaging to process orders from placement through delivery.

## The services

| Service | Domain | Responsibility |
|---------|--------|----------------|
| **order-service** | Orders | Create orders, manage lifecycle, emit events |
| **inventory-service** | Stock | Check availability, reserve and release stock |
| **payment-service** | Payments | Process payments, handle refunds |
| **shipping-service** | Shipments | Schedule carriers, track deliveries |
| **notification-service** | Notifications | Consume events, send email/SMS alerts |

## The stack

All examples run against a local Podman stack that includes:

- **Apache Kafka** (KRaft mode) — primary message broker
- **Apache Pulsar** — alternative broker for specific patterns
- **Redis** — caching, idempotent repository, claim check store
- **PostgreSQL** — persistence, message store, aggregation repository
- **Apicurio Registry** — schema registry for Avro and Protobuf
- **LGTM stack** — Grafana, Loki, Tempo, Mimir with OpenTelemetry

> **Content coming soon** — this chapter will be expanded with the full domain model, Avro schemas, and a walkthrough of the Podman stack.
