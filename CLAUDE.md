# CLAUDE.md

## Project overview

A chaptered tutorial site covering all 65 Enterprise Integration Patterns (Hohpe & Woolf) implemented with Apache Camel on Quarkus. Jekyll site + runnable Camel Quarkus examples.

## Key conventions

- **Java DSL only** — no YAML DSL or XML DSL in code examples or codetabs
- **Shipping domain** — all examples use orders, inventory, payments, shipping, notifications
- **No Co-authored-by trailers** in git commits

## Stack

- Apache Camel 4.x with Camel Quarkus on Quarkus 3.x
- Kafka (KRaft), Pulsar, Redis, PostgreSQL on Podman
- Jekyll for the tutorial site (light amber theme, Red Hat fonts)

## Structure

```
_docs/          — tutorial chapters (Jekyll docs collection)
_parts/         — part index pages
_layouts/       — Jekyll layouts
_includes/      — Jekyll includes (excalidraw.html for diagrams)
assets/         — CSS, diagrams (SVG + Excalidraw source)
examples/       — runnable Camel Quarkus projects
  _infra/       — Podman compose stack (Kafka, Pulsar, Redis, PostgreSQL)
  domain-model/ — shared canonical entities
  05-reliability/ through bond-trading/ — per-chapter and case-study examples
scripts/        — setup-stack.sh, generate_diagram.py
```

## Build commands

```bash
# Jekyll site
bundle exec jekyll build
bundle exec jekyll serve

# Examples
cd examples/<name> && mvn quarkus:dev

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
