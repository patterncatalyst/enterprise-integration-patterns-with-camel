# CLAUDE.md

## Project overview

A chaptered tutorial site covering all 65 Enterprise Integration Patterns (Hohpe & Woolf) implemented with Apache Camel on three runtimes: Quarkus (Java DSL), Spring Boot (Java DSL), and YAML DSL. Jekyll site + runnable examples per runtime.

## Key conventions

- **Three runtimes** — Quarkus (Java DSL), Spring Boot (Java DSL), YAML DSL in tabbed code blocks
- **Codetabs** — use `{% include codetabs.html langs="Quarkus|Spring Boot|YAML DSL" %}` followed by one fenced code block per tab (order must match labels). Not every block needs tabs — only tabify route definitions and configuration that differ per runtime.
- **Shipping domain** — all examples use orders, inventory, payments, shipping, notifications
- **No Co-authored-by trailers** in git commits

## Stack

- Apache Camel 4.x with Camel Quarkus on Quarkus 3.x and Camel Spring Boot
- Kafka (KRaft), Pulsar, Redis, PostgreSQL on Podman
- Jekyll for the tutorial site (light amber theme, Red Hat fonts)

## Structure

```
_docs/          — tutorial chapters (Jekyll docs collection)
_parts/         — part index pages
_layouts/       — Jekyll layouts
_includes/      — Jekyll includes (excalidraw.html, codetabs.html)
assets/         — CSS, JS (codetabs.js), diagrams (SVG + Excalidraw source)
examples/       — runnable examples, each with subdirectories per runtime
  _infra/       — Podman compose stack (Kafka, Pulsar, Redis, PostgreSQL)
  domain-model/ — shared canonical entities (framework-agnostic POJOs)
  NN-name/      — per-chapter examples
    quarkus/    — Camel Quarkus variant
    spring-boot/ — Camel Spring Boot variant
    yaml-dsl/   — YAML DSL variant (where applicable)
scripts/        — setup-stack.sh, generate_diagram.py
```

## Build commands

```bash
# Jekyll site
bundle exec jekyll build
bundle exec jekyll serve

# Quarkus examples
cd examples/<name>/quarkus && mvn quarkus:dev

# Spring Boot examples
cd examples/<name>/spring-boot && mvn spring-boot:run

# YAML DSL examples (via Camel CLI / JBang)
cd examples/<name>/yaml-dsl && camel run *.yaml

# Infrastructure
./scripts/setup-stack.sh          # base stack
./scripts/setup-stack.sh --lgtm   # with observability

# Diagrams
python3 scripts/generate_diagram.py  # imported as a module, see existing usage
```

## Chapter conventions

- Front matter: title, order, part, description, duration
- `part` value must match a `_parts` file's `part_name`
- Chapters end with a verification status footer (unverified until run in real environment)
- Diagrams: `{% include excalidraw.html file="name" alt="..." caption="Figure N.x — ..." %}`
- Quote YAML front matter values that contain colons
