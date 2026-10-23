---
title: "Bibliography"
layout: plan
permalink: /bibliography/
description: "The book and primary documentation this site's coverage and rigor draw on: nothing here is reproduced from them."
---

This site implements the 65 patterns of Hohpe and Woolf's *Enterprise Integration
Patterns* on Apache Camel, so that book is the canonical reference throughout; each
chapter cites the matching EIP chapter. The Camel and runtime documentation below
is the authority for the components and DSLs the examples use. These are reference
works, not sources: no text or code from any of them is reproduced here.

## Books

| Title | Author(s) | Publisher | Year | Focus |
|---|---|---|---|---|
| [*Enterprise Integration Patterns: Designing, Building, and Deploying Messaging Solutions*](https://www.enterpriseintegrationpatterns.com/) | Gregor Hohpe, Bobby Woolf | Addison-Wesley | 2003 | The 65 messaging patterns, their intent, and the pattern language this site implements |

## Primary documentation

| Source | Link | Used for |
|---|---|---|
| Apache Camel | [camel.apache.org/docs](https://camel.apache.org/docs/) | The EIP DSL, components, and the routing/transformation engine |
| Camel Quarkus | [camel.apache.org/camel-quarkus](https://camel.apache.org/camel-quarkus/) | The Quarkus (Java DSL) runtime |
| Camel on Spring Boot | [camel.apache.org/camel-spring-boot](https://camel.apache.org/camel-spring-boot/) | The Spring Boot (Java DSL) runtime |
| Camel YAML DSL | [camel.apache.org/components/latest/others/yaml-dsl](https://camel.apache.org/components/latest/others/yaml-dsl.html) | The YAML DSL runtime and `camel` CLI |
| Enterprise Integration Patterns site | [enterpriseintegrationpatterns.com](https://www.enterpriseintegrationpatterns.com/) | Hohpe and Woolf's per-pattern reference pages |
| Apache Kafka | [kafka.apache.org/documentation](https://kafka.apache.org/documentation/) | The primary message broker (KRaft) |
| Apache Pulsar | [pulsar.apache.org/docs](https://pulsar.apache.org/docs/) | The alternate broker in the Pulsar appendix |
| Quarkus | [quarkus.io/guides](https://quarkus.io/guides/) | The Quarkus runtime, Dev Services, and native build |

These titles inform this site's coverage and rigor only. Nothing in these chapters
or the runnable examples copies text or code from them.
