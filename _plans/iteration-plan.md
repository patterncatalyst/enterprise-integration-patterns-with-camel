---
title: "Iteration Plan"
description: "Build roadmap for the Enterprise Integration Patterns with Apache Camel tutorial — from initial scaffold through live verification."
render_with_liquid: false
---

## Iteration 1 — Site Scaffold & Foundations

**Status:** Complete

Delivered the Jekyll tutorial site skeleton, initial chapters, infrastructure,
and the shipping domain running example.

| Deliverable | Detail |
|---|---|
| Jekyll site | Light amber theme, Red Hat fonts, `tutorial` / `part_index` / `plan` layouts |
| Chapter 00 | Prerequisites & Setup |
| Chapter 01 | The Running Example (shipping domain) |
| Chapter 02 | Integration Styles |
| Chapter 03 | Messaging Systems Overview |
| Parts index | 10 part index pages (`_parts/`) |
| Infra stack | `compose.yaml` — Kafka (KRaft), Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI |
| Bootstrap script | `scripts/setup-stack.sh` |
| Diagrams | `01-order-flow`, `01-stack-architecture`, `02-integration-styles`, `03-messaging-system-components`, `03-pipes-and-filters` (SVG + Excalidraw) |
| Domain model | `examples/domain-model/` — Order, PaymentRequest, InventoryReservation, ShipmentEvent, Notification |


## Iteration 2 — Core Pattern Chapters (04-11) with Examples

**Status:** Complete

Wrote the eight core pattern chapters covering Messaging Channels, Message
Construction, and Message Routing, plus the first wave of runnable examples.

| Deliverable | Detail |
|---|---|
| Chapter 04 | Channel Types — point-to-point, pub-sub, datatype channels |
| Chapter 05 | Channel Reliability — invalid message channel, dead letter channel, guaranteed delivery |
| Chapter 06 | Channel Infrastructure — channel adapters, messaging bridge, message bus |
| Chapter 07 | Message Types — command, document, event messages |
| Chapter 08 | Message Metadata — request-reply, correlation ID, return address, sequences, expiration, format indicator |
| Chapter 09 | Routing Fundamentals — CBR, message filter, recipient list, splitter |
| Chapter 10 | Composed Routing — routing slip, process manager, scatter-gather |
| Chapter 11 | Advanced Routing — dynamic router, wire tap, resequencer, composed message processor, load balancer |
| Examples | `04-channel-types`, `05-reliability`, `06-channel-infra`, `07-message-types`, `08-message-metadata`, `09-routing-fundamentals`, `10-composed-routing`, `11-advanced-routing` |
| Diagrams | Chapter diagrams (04-11) and example architecture diagrams (`ex-04` through `ex-11`) |


## Iteration 3 — Advanced Pattern Chapters (12-18) with Examples

**Status:** Complete

Completed the remaining pattern chapters covering Message Transformation,
Messaging Endpoints, and System Management.

| Deliverable | Detail |
|---|---|
| Chapter 12 | Transformation Fundamentals — message translator, envelope wrapper, content enricher, content filter |
| Chapter 13 | Structural Transformation — aggregator, normalizer, canonical data model |
| Chapter 14 | Consumer Patterns — polling consumer, event-driven consumer, competing consumers, message dispatcher |
| Chapter 15 | Producer and Transactional Patterns — durable subscriber, idempotent receiver, transactional client, service activator |
| Chapter 16 | Endpoint Management — messaging gateway, selective consumer, channel purger, messaging mapper |
| Chapter 17 | Observability — control bus, message store, message history, wire tap (monitoring) |
| Chapter 18 | Testing and Management — test message, detour, smart proxy, channel adapter management |
| Examples | `12-transformation`, `13-aggregator`, `14-consumer-patterns`, `15-endpoints`, `16-endpoint-management`, `17-observability`, `18-testing-management` |
| Diagrams | Chapter diagrams (12-18) and example architecture diagrams (`ex-12` through `ex-18`) |


## Iteration 4 — Case Studies with Examples

**Status:** Complete

Built the two end-to-end EIP case studies that compose multiple patterns into
realistic integration architectures.

| Deliverable | Detail |
|---|---|
| Chapter 28 | Appendix J — Loan Broker case study (classic Hohpe & Woolf example reimagined with Camel + Kafka) |
| Chapter 29 | Appendix K — Bond Trading case study (market data distribution and trade execution) |
| Examples | `loan-broker`, `bond-trading` |
| Diagrams | `28-loan-broker`, `29-bond-trading`, `ex-loan-broker`, `ex-bond-trading` |
| Shared Containerfile | `examples/Containerfile` for building example images |


## Iteration 5 — Appendices (A-L)

**Status:** Complete

Wrote the twelve appendix chapters providing deep-dive references on the
technology stack and supplementary topics.

| Deliverable | Detail |
|---|---|
| Chapter 19 | Appendix A — Camel on Spring Boot vs Quarkus |
| Chapter 20 | Appendix B — Kafka Deep Dive |
| Chapter 21 | Appendix C — Pulsar Deep Dive |
| Chapter 22 | Appendix D — Redis for Integration |
| Chapter 23 | Appendix E — Quarkus Dev Mode |
| Chapter 24 | Appendix F — Drools and Business Rules |
| Chapter 25 | Appendix G — Quarkus Flow |
| Chapter 26 | Appendix H — Feature Flags |
| Chapter 27 | Appendix I — Observability Stack |
| Chapter 28 | Appendix J — Loan Broker Case Study |
| Chapter 29 | Appendix K — Bond Trading Case Study |
| Chapter 30 | Appendix L — Glossary |
| DSL cleanup | Stripped YAML/XML codetabs, rewrote Appendix A as Spring Boot vs Quarkus comparison |
| Diagrams | `20-kafka-architecture`, `21-pulsar-architecture`, `23-promotion-workflow`, `26-feature-flags` |


## Iteration 6 — Diagrams, README Enrichment, Polish

**Status:** Complete

Added Excalidraw/SVG diagrams to all chapters and examples, enriched READMEs,
upgraded dependencies, and added presentation decks.

| Deliverable | Detail |
|---|---|
| Diagrams | 44 SVG diagrams (87 files total with Excalidraw sources) across chapters, examples, and appendices |
| Example READMEs | Standardized and enriched all 17 example README documents; replaced ASCII data-flow diagrams with SVG visuals |
| Presentations | EIP 101 and EIP 201 slide decks |
| Dependency upgrade | Quarkus 3.36.3 / Camel Quarkus 3.36.0 |
| Multi-broker expansion | Examples expanded to use Pulsar, PostgreSQL, and the full Podman stack (not just Kafka) |
| Redis integration | Added Redis usage to examples 04 and 12 |
| LGTM stack | `compose.lgtm.yaml` with Grafana, Loki, Mimir, Tempo, OTel Collector for observability |
| CI | GitHub Actions workflow for example builds |
| Docs | GETTING-STARTED.md, CONTRIBUTING.md, CLAUDE.md |


## Iteration 7 — Verification Against Live Infrastructure

**Status:** Planned

Run every example against the real Podman infrastructure stack and verify all
claims made in the tutorial chapters.

| Deliverable | Detail |
|---|---|
| Stack verification | Confirm `setup-stack.sh` brings up all services (Kafka, Pulsar, Redis, PostgreSQL, Apicurio, Kafka UI) |
| Build verification | `mvn compile` succeeds for all 17 examples + domain-model |
| Runtime verification | `mvn quarkus:dev` starts routes, connects to infrastructure, processes demo data |
| Pattern verification | Each pattern claimed in a chapter is demonstrated by the corresponding example |
| Cross-reference audit | Chapter references to code (class names, route IDs, topic names) match what is actually in the examples |
| Infrastructure audit | Ports, topic names, schema/table names in chapters match `compose.yaml` and `init-schemas.sql` |
| Diagram accuracy | Architecture diagrams match the actual code topology |
| Chapter footer update | Replace "unverified" status footers with "verified" and verification date |
| LGTM stack verification | Confirm observability stack starts, traces flow through, dashboards render |
| Reconciliation plan | Complete the reconciliation checklist in `_plans/reconciliation-plan.md` |
