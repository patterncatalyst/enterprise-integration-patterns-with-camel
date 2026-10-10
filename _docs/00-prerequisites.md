---
title: "Prerequisites & Setup"
order: 0
part: getting-started
description: "Install Java 25, JBang, the Camel CLI, Maven, Docker Engine, and the tools you need to run every example locally."
duration: "30 minutes"
---

Before you write a single route, you need a working development environment. This chapter walks you through every tool — Java, JBang, the Camel CLI, Maven, Docker Engine, an IDE — and finishes with a smoke test that proves the whole stack is healthy. If you already have these tools installed, skim the version checks and jump to the stack verification at the end.

## Java 25

Every example in this tutorial runs on **Java 25** (the current long-term-support release). Camel 4.x requires a minimum of Java 17, but we target 25 for its virtual threads without pinning (JDK 24+ fixed `synchronized` monitor pinning), ScopedValue for context propagation, pattern matching, and record patterns — features that make integration code cleaner and more expressive.

### Installing with SDKMAN

[SDKMAN](https://sdkman.io/) manages parallel JDK installations and makes switching between versions painless. It needs `zip` and `unzip` present first — without them the installer stops with `Looking for unzip... Not found.`, which is easy to miss if you pipe it to `bash`:

```bash
sudo dnf install -y zip unzip
```

Then install SDKMAN itself:

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

Then install Java 25:

```bash
sdk install java 25.0.4-tem
```

This installs the Temurin (Eclipse Adoptium) distribution — a solid, well-tested OpenJDK build. Other distributions work too (`sdk list java` shows them); the runtime is the same OpenJDK underneath.

Verify:

```bash
java -version
# openjdk version "25.0.4" ...
```

### Why Java 25?

Java 25 is the current LTS release (after 21), and brings meaningful improvements for integration workloads: JDK 24 eliminated `synchronized` monitor pinning for virtual threads, JDK 25 finalized `ScopedValue` for lightweight context propagation, and the overall runtime is faster and leaner. Both Quarkus 3.31+ and Spring Boot 4.0+ fully support Java 25. We target the LTS because it's the version you'll use in production. Quarkus *does* support GraalVM native compilation, and several Camel components have native support, but native builds add compilation time and reduce the set of components available at runtime. We'll use JVM mode throughout this tutorial and note where native is an option.

## JBang & the Camel CLI

**JBang** lets you run Java source files directly — no project scaffolding, no `pom.xml`, no build step. The **Camel CLI** (`camel`), installed through JBang, is the fastest way to run, test, and explore Camel routes. Most pattern examples in this tutorial are single route files that you run with `camel run` — no Maven project required. When you're ready to promote a prototype into a full Quarkus or Spring Boot application, `camel export` generates the project for you.

### Installing JBang

```bash
curl -Ls https://sh.jbang.dev | bash -s - app setup
```

Or via SDKMAN:

```bash
sdk install jbang
```

Verify:

```bash
jbang --version
# 0.142.x
```

### Installing the Camel CLI

Install it from its pinned Maven Central artifact, on the same Camel line the Quarkus platform BOM pins:

```bash
jbang app install --name camel org.apache.camel:camel-launcher:4.22.1
```

This installs the `camel` command globally. Verify:

```bash
camel version
# Apache Camel CLI 4.22.1
```

Do not install the `camel@apache/camel` catalog alias: it runs the CLI source from GitHub at `HEAD`, adds the Apache snapshot repository, and makes JBang ask you to trust the source.

### What the Camel CLI gives you

The Camel CLI is how you'll interact with most examples in this tutorial:

| Command | Purpose |
|---------|---------|
| `camel run route.yaml` | Run a route file (Java, YAML, or XML DSL) |
| `camel run --dev route.yaml` | Run with live reload — edit the file, Camel restarts automatically |
| `camel init hello.yaml` | Scaffold a new route file from a template |
| `camel export --runtime=quarkus` | Export route files to a full Quarkus Maven project |
| `camel export --runtime=spring-boot` | Export route files to a full Spring Boot Maven project |
| `camel get` | Inspect running routes (endpoints, statistics) |
| `camel trace` | Trace messages flowing through routes |
| `camel top` | Live performance view of running routes |
| `camel doc kafka` | Show documentation for a component or kamelet |
| `camel search --component file` | Search the component catalog |

### Quick smoke test

Create a one-line route and run it to confirm everything is wired up:

```bash
camel init hello.yaml
camel run hello.yaml
```

You should see Camel start up, log a greeting, and keep running. Press `Ctrl+C` to stop.

### The tutorial workflow

The development loop for most chapters looks like this:

1. **Prototype with `camel run`** — Write a route in a single file (YAML, Java, or XML DSL) and run it directly. No project, no POM, no build. Use `--dev` for live reload while you iterate.
2. **Inspect with `camel get` / `camel trace`** — See what routes are active, trace messages through them, monitor throughput.
3. **Promote with `camel export`** — When a route is ready for the full stack (dependency injection, runtime config, database integration, container packaging), export it to a Quarkus or Spring Boot project.

This keeps the feedback loop tight — seconds, not minutes — while you're learning patterns. The projects in `examples/` are the promoted versions of these prototypes, available in both Quarkus and Spring Boot variants.

## Apache Maven

Maven 3.9+ is the build tool for the Quarkus and Spring Boot projects in this tutorial. You won't need Maven for most pattern examples (those run directly with `camel run`), but you'll need it when you work with the full projects in `examples/` and for the case study implementations.

### Installing with SDKMAN

```bash
sdk install maven
```

Verify:

```bash
mvn -version
# Apache Maven 3.9.x ...
# Java version: 25.0.x
```

Make sure Maven reports the Java 25 JDK you just installed. If it picks up an older JDK, set `JAVA_HOME` explicitly:

```bash
export JAVA_HOME=$(sdk home java 25.0.4-tem)
```

### Maven settings for this tutorial

No special `settings.xml` is needed. All dependencies come from Maven Central, and the runtime BOMs manage version alignment. The projects lock these versions:

| Dependency | Version |
|-----------|---------|
| Apache Camel | 4.22.1 |
| Camel Quarkus | 3.40.0 |
| Quarkus | 3.40.1 (LTS) |
| Camel Spring Boot | 4.22.1 |
| Spring Boot | 4.1.1 |
| Camel CLI (`camel-launcher`) | 4.22.1 |
| Drools | 10.2.0 |

You'll see these in the `<dependencyManagement>` section of every `pom.xml`. When a new Camel release ships, upgrading is a BOM version bump in Maven and a re-install of `camel-launcher` at the new version for the CLI.

## Docker Engine & Docker Compose

The local infrastructure — Kafka, Pulsar, Redis, PostgreSQL, Apicurio, and the optional LGTM observability stack — runs in containers on **Docker Engine** (`docker-ce`), driven by the **Docker Compose v2 plugin** (`docker compose`, with a space). The same engine runs the Testcontainers-backed integration tests, so there is exactly one container engine in play. No desktop application is needed. The instructions target Fedora and RHEL hosts (bare metal or VM).

### Installing Docker Engine

Docker Engine comes from Docker's own repository, not the distribution's. On **Fedora**:

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

On **RHEL**, use the RHEL repository file instead:

```bash
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Let your user talk to the daemon without `sudo`, then log out and back in (or run `newgrp docker`):

```bash
sudo usermod -aG docker "$USER"
```

Verify:

{% raw %}
```bash
docker version --format '{{.Server.Version}}'
# 29.x

docker compose version
# Docker Compose version v5.x

docker context show
# default
```
{% endraw %}

`docker context show` must print `default`, the local daemon on `/var/run/docker.sock`. Every script in this repository, and Testcontainers, talks to that socket. Use `docker compose`, never the legacy `docker-compose` binary.

### Testcontainers and the Docker socket

The Citrus integration tests — the ones behind `mvn verify` in most examples —
start their own throwaway containers through **Testcontainers**, which finds
Docker Engine on `/var/run/docker.sock` with no configuration. If the daemon is
not running, or your user is not in the `docker` group, the tests fail with
"Could not find a valid Docker environment". Fix the daemon, not the tests:

```bash
systemctl is-active docker        # active
docker info >/dev/null && echo ok # ok
```

`scripts/build-all-examples.sh` runs the same check before it builds anything.

Leave Ryuk, the sidecar Testcontainers uses to reap leftover containers,
enabled; turning it off (`TESTCONTAINERS_RYUK_DISABLED=true`) means interrupted
runs leave containers behind.

One more thing that will bite you: **the integration tests and the dev stack
cannot both be running.** Both bind 9092, 6379, 5432 and 6650. The symptom is a
container failing to start with something unhelpful like "Local Docker Compose
exited abnormally". Shut the stack down first:

```bash
docker compose -p eip -f examples/_infra/compose.yaml down
```

### Resource limits

The compose files in `examples/_infra/` set `mem_limit` on memory-hungry services (Kafka gets 1 GB, Redis gets 512 MB). On Fedora and RHEL with cgroups v2 these limits work out of the box. Plan for about 8 GB of free memory and 4 CPUs for the full stack (base + LGTM); the base stack alone (Kafka, Pulsar, Redis, PostgreSQL, Apicurio) fits in 4 GB.

### Host ports

Every service publishes on a fixed host port (see the port map below). On Fedora Server and RHEL, Cockpit owns port 9090; nothing in this tutorial uses it. If a port is already taken, `ss -ltnp | grep :<port>` names the process.

## GitHub CLI (`gh`)

The `gh` CLI is optional but useful: it lets you clone the tutorial repo, check GitHub Actions status, and interact with issues and pull requests from the terminal.

```bash
sudo dnf install -y gh
```

Authenticate:

```bash
gh auth login
```

Clone the tutorial repository:

```bash
gh repo clone patterncatalyst/enterprise-integration-patterns-with-camel
cd enterprise-integration-patterns-with-camel
```

## IDE setup

Any IDE with Java 25 support will work. We recommend either **VS Code** or **IntelliJ IDEA** — both have excellent Quarkus and Spring Boot extensions that provide live reload, configuration assistance, and route visualization.

### VS Code

Install the following extensions:

| Extension | Purpose |
|-----------|---------|
| **Quarkus** (`redhat.vscode-quarkus`) | Dev mode, config completion, deployment descriptors |
| **Spring Boot Extension Pack** (`vmware.vscode-boot-dev-pack`) | Spring Boot support, config completion |
| **Language Support for Java** (`redhat.java`) | Java language server |
| **XML** (`redhat.vscode-xml`) | XML DSL syntax and validation |
| **YAML** (`redhat.vscode-yaml`) | YAML DSL syntax and validation |
| **Apache Camel** (`redhat.vscode-apache-camel`) | Camel route completion, endpoint URI validation |

Open the project root folder in VS Code. The Quarkus and Spring Boot extensions will detect the Maven projects and offer to start dev mode.

### IntelliJ IDEA

IntelliJ IDEA Ultimate includes built-in Quarkus and Spring Boot support. Community Edition users should install the **Quarkus Tools** plugin from the JetBrains Marketplace.

Additional useful plugins:

| Plugin | Purpose |
|--------|---------|
| **Apache Camel** | Route visualization, endpoint completion |
| **Database Tools** | Connect to the local PostgreSQL instance |

Import the project as a Maven project. IntelliJ will resolve dependencies and index the Camel route builders automatically.

### IDE-independent settings

Regardless of your IDE:
- Set the project SDK to Java 25.
- Make sure Maven uses the same JDK (check IDE Maven settings).
- Enable annotation processing (both Quarkus and Spring Boot use it for bean generation).

## The local stack

The tutorial's infrastructure lives in `examples/_infra/`. Two compose files provide everything:

| File | Services | Purpose |
|------|----------|---------|
| `compose.yaml` | Kafka (KRaft), Kafka UI, Pulsar, Redis, PostgreSQL, Apicurio | Core messaging and persistence |
| `compose.lgtm.yaml` | Grafana, Loki, Tempo, Mimir, OTel Collector | Observability (logs, traces, metrics) |

### Starting the base stack

The bootstrap script handles everything:

```bash
./scripts/setup-stack.sh
```

This runs `docker compose up -d` against the base compose file, waits for health checks, and reports status. First run pulls images — expect a few minutes depending on your connection.

### Starting the full stack (with observability)

```bash
./scripts/setup-stack.sh --lgtm
```

This adds the LGTM overlay (Grafana, Loki, Tempo, Mimir, OTel Collector) on top of the base services. The observability stack is optional for most chapters but required for Part 8 (System Management) and Appendix I (Observability).

### Port map

Once running, these services are available on localhost:

| Service | Port | URL |
|---------|------|-----|
| Kafka broker | 9092 | `localhost:9092` |
| Kafka UI | 8090 | [http://localhost:8090](http://localhost:8090) |
| Pulsar broker | 6650 | `localhost:6650` |
| Pulsar admin | 8080 | [http://localhost:8080](http://localhost:8080) |
| Redis | 6379 | `localhost:6379` |
| PostgreSQL | 5432 | `localhost:5432` (user: `eipuser`, password: `eippass`, db: `eipdb`) |
| Apicurio Registry | 8081 | [http://localhost:8081](http://localhost:8081) |
| Grafana | 3000 | [http://localhost:3000](http://localhost:3000) (LGTM mode) |

### Verifying the stack

After `setup-stack.sh` completes, verify each service:

```bash
# Kafka — list topics (should return empty or internal topics)
docker exec eip-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Pulsar — check broker status
docker exec eip-pulsar bin/pulsar-admin brokers healthcheck

# Redis — ping
docker exec eip-redis redis-cli ping
# PONG

# PostgreSQL — check schemas
docker exec eip-postgres psql -U eipuser -d eipdb \
  -c "SELECT schema_name FROM information_schema.schemata \
      WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast','public');"
# orders, inventory, payments, shipping, notifications

# Apicurio — health check
curl -sf http://localhost:8081/health/ready | python3 -m json.tool
```

If all five checks pass, your environment is ready for every example in this tutorial.

### Stopping and cleaning up

```bash
# Stop all services (data volumes are preserved)
docker compose -p eip -f examples/_infra/compose.yaml down

# Stop including LGTM
docker compose -p eip -f examples/_infra/compose.yaml \
  -f examples/_infra/compose.lgtm.yaml down

# Full cleanup (removes volumes — you lose all data)
docker compose -p eip -f examples/_infra/compose.yaml down -v
```

## Turning off the demo data generators

Most examples ship a timer-driven route that manufactures sample traffic, so
that starting an example gives you something to watch without having to publish
messages by hand. That is convenient when you are reading a chapter and
unhelpful when you are running the integration tests, so each generator sits
behind a configuration flag that defaults to `true`.

Set the flag to `false` to start an example with its routes in place but no
synthetic traffic flowing:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
mvn quarkus:dev -Deip.demo.data.generator.enabled=false
```

```bash
# Spring Boot
mvn spring-boot:run -Dspring-boot.run.arguments=--eip.demo.data.generator.enabled=false
```

The flags follow the route they control, so an example with more than one
generator has more than one flag:

| Flag | Controls |
|------|----------|
| `eip.demo.data.generator.enabled` | The general-purpose order generator, used by most examples |
| `eip.pulsar.demo.data.generator.enabled` | The Pulsar order generator |
| `eip.redis.demo.data.generator.enabled` | The Redis order generator |
| `eip.pulsar.producer.enabled` | The Pulsar keyed and shared-subscription producers |
| `eip.partitioned.producer.enabled` | The Kafka partitioned producer |
| `eip.consumer.lag.monitor.enabled` | The Kafka consumer lag monitor |
| `eip.distributed.lock.enabled` | The Redis distributed lock demo |
| `eip.gateway.demo.enabled` | The messaging gateway demo timer |
| `eip.test.message.injector.enabled` | The synthetic test-message injector |

Every flag defaults to `true`, so the examples behave exactly as the chapters
describe unless you turn something off. The Citrus integration tests set them to
`false` themselves; you do not need to do it for them.

## What you learned

- Java 25 via SDKMAN, Maven 3.9+, and how to ensure they're wired together.
- JBang and the Camel CLI — the fastest way to run, inspect, and prototype Camel routes from single files.
- The tutorial workflow: prototype with `camel run --dev`, inspect with `camel get` / `camel trace`, promote with `camel export --runtime=quarkus` (or `--runtime=spring-boot`).
- Docker Engine and the `docker compose` plugin on the default context, which
  serve both the local stack and the Testcontainers-backed integration tests.
- The two-tier local stack: base infrastructure and optional LGTM observability.
- How to verify that every service is healthy and ready.

Next, we'll meet the shipping domain that drives every example in this tutorial — the five services, the data model, and how they collaborate through messaging.

---

*Verification status: <span class="status status--verified">verified</span> — on Docker Engine with Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1): `./scripts/setup-stack.sh` and `--lgtm` bring every service to healthy, `redis-cli ping` answers `PONG`, `init-schemas.sql` creates all five domain schemas, and the OTel Collector health endpoint and Grafana both answer 200 (2026-10-09). The SDKMAN chain itself was last run on a clean `fedora:44` container on 2026-09-14.*

*Not verified here: the SDKMAN install commands, which need a clean machine to test honestly.*
