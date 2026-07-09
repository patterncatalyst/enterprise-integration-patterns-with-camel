---
title: "Prerequisites & Setup"
order: 0
part: getting-started
description: "Install Java 21, Maven, Podman, and the tools you need to run every example locally."
duration: "30 minutes"
---

Before you write a single route, you need a working development environment. This chapter walks you through every tool — Java, Maven, Podman, an IDE — and finishes with a smoke test that proves the whole stack is healthy. If you already have these tools installed, skim the version checks and jump to the stack verification at the end.

## Java 21

Every example in this tutorial runs on **Java 21** (the current long-term-support release). Camel 4.x requires a minimum of Java 17, but we target 21 for its virtual threads, pattern matching, and record patterns — features that make integration code cleaner and more expressive.

### Installing with SDKMAN

[SDKMAN](https://sdkman.io/) manages parallel JDK installations and makes switching between versions painless. If you don't already have it:

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
```

Then install Java 21:

```bash
sdk install java 21.0.7-tem
```

This installs the Temurin (Eclipse Adoptium) distribution — a solid, well-tested OpenJDK build. Other distributions work too (`21.0.7-graal`, `21.0.7-amzn`, etc.); the runtime is the same OpenJDK underneath.

Verify:

```bash
java -version
# openjdk version "21.0.7" ...
```

### Why not Java 22+ or GraalVM native?

Java 22 and later work fine with Camel 4.20, but we pin to 21 because it's the LTS — the version you'll use in production. Quarkus *does* support GraalVM native compilation, and several Camel components have native support, but native builds add compilation time and reduce the set of components available at runtime. We'll use JVM mode throughout this tutorial and note where native is an option.

## Apache Maven

Maven 3.9+ is the build tool for every Quarkus project in this tutorial. Quarkus also supports Gradle, but the Camel Quarkus extensions and BOMs are most thoroughly tested against Maven, and every example in the EIP book's reference implementations uses Maven.

### Installing with SDKMAN

```bash
sdk install maven
```

Verify:

```bash
mvn -version
# Apache Maven 3.9.x ...
# Java version: 21.0.x
```

Make sure Maven reports the Java 21 JDK you just installed. If it picks up an older JDK, set `JAVA_HOME` explicitly:

```bash
export JAVA_HOME=$(sdk home java 21.0.7-tem)
```

### Maven settings for this tutorial

No special `settings.xml` is needed. All dependencies come from Maven Central, and the Quarkus BOM manages version alignment. Each example project inherits from a parent POM that locks these versions:

| Dependency | Version |
|-----------|---------|
| Apache Camel | 4.20.0 |
| Camel Quarkus | 3.36.0 |
| Quarkus | 3.36.x |
| Drools | 10.2.0 |

You'll see these in the `<dependencyManagement>` section of every `pom.xml`. When a new Camel Quarkus release ships, upgrading is a single BOM version bump.

## Podman & podman-compose

The local infrastructure — Kafka, Pulsar, Redis, PostgreSQL, Apicurio, and the optional LGTM observability stack — runs in containers managed by **Podman**. Podman is a daemonless, rootless container engine that runs OCI containers; if you're used to Docker, the CLI is almost identical.

### Why Podman over Docker?

Podman runs containers without a root daemon, which means no `sudo`, no Docker socket to secure, and a smaller attack surface on your workstation. Every `docker` command you know has a `podman` equivalent. The compose files in this tutorial use standard Compose syntax and work with both engines — but we'll reference `podman` and `podman-compose` throughout.

### Installing Podman

**Fedora / RHEL / CentOS Stream:**
```bash
sudo dnf install -y podman podman-compose
```

**Ubuntu / Debian:**
```bash
sudo apt-get update
sudo apt-get install -y podman
pip install podman-compose
```

**macOS (via Homebrew):**
```bash
brew install podman podman-compose
podman machine init
podman machine start
```

On macOS, Podman runs a lightweight Linux VM behind the scenes. The `podman machine init` step creates it; `podman machine start` boots it. You only need to do this once.

**Windows (via WSL2):**
Install Podman Desktop from [podman-desktop.io](https://podman-desktop.io) or use Podman inside your WSL2 distribution.

Verify:

```bash
podman --version
# podman version 5.x.x

podman-compose --version
# podman-compose version 1.x.x
```

### Rootless containers and resource limits

The compose files in `examples/_infra/` set `mem_limit` on memory-hungry services (Kafka gets 1 GB, Redis gets 512 MB). On Linux with cgroups v2, these limits work out of the box in rootless mode. On macOS, the limits are enforced inside the Podman machine VM — make sure you allocated enough memory when you initialized it:

```bash
podman machine init --memory 8192 --cpus 4
```

8 GB and 4 CPUs is comfortable for the full stack (base + LGTM). If you only run the base stack (Kafka, Pulsar, Redis, PostgreSQL, Apicurio), 4 GB is enough.

## GitHub CLI (`gh`)

The `gh` CLI is optional but useful: it lets you clone the tutorial repo, check GitHub Actions status, and interact with issues and pull requests from the terminal.

```bash
# Fedora / RHEL
sudo dnf install -y gh

# macOS
brew install gh

# Ubuntu / Debian
sudo apt-get install -y gh
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

Any IDE with Java 21 support will work. We recommend either **VS Code** or **IntelliJ IDEA** — both have excellent Quarkus extensions that provide live reload, configuration assistance, and route visualization.

### VS Code

Install the following extensions:

| Extension | Purpose |
|-----------|---------|
| **Quarkus** (`redhat.vscode-quarkus`) | Dev mode, config completion, deployment descriptors |
| **Language Support for Java** (`redhat.java`) | Java language server |
| **XML** (`redhat.vscode-xml`) | XML DSL syntax and validation |
| **YAML** (`redhat.vscode-yaml`) | YAML DSL syntax and validation |
| **Apache Camel** (`redhat.vscode-apache-camel`) | Camel route completion, endpoint URI validation |

Open the project root folder in VS Code. The Quarkus extension will detect the Maven projects and offer to start dev mode.

### IntelliJ IDEA

IntelliJ IDEA Ultimate includes built-in Quarkus support. Community Edition users should install the **Quarkus Tools** plugin from the JetBrains Marketplace.

Additional useful plugins:

| Plugin | Purpose |
|--------|---------|
| **Apache Camel** | Route visualization, endpoint completion |
| **Database Tools** | Connect to the local PostgreSQL instance |

Import the project as a Maven project. IntelliJ will resolve dependencies and index the Camel route builders automatically.

### IDE-independent settings

Regardless of your IDE:
- Set the project SDK to Java 21.
- Make sure Maven uses the same JDK (check IDE Maven settings).
- Enable annotation processing (Quarkus uses it for CDI bean generation).

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

This runs `podman-compose up -d` against the base compose file, waits for health checks, and reports status. First run pulls images — expect a few minutes depending on your connection.

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
podman exec eip-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Pulsar — check broker status
podman exec eip-pulsar bin/pulsar-admin brokers healthcheck

# Redis — ping
podman exec eip-redis redis-cli ping
# PONG

# PostgreSQL — check schemas
podman exec eip-postgres psql -U eipuser -d eipdb \
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
podman-compose -f examples/_infra/compose.yaml down

# Stop including LGTM
podman-compose -f examples/_infra/compose.yaml \
  -f examples/_infra/compose.lgtm.yaml down

# Full cleanup (removes volumes — you lose all data)
podman-compose -f examples/_infra/compose.yaml down -v
```

## What you learned

- Java 21 via SDKMAN, Maven 3.9+, and how to ensure they're wired together.
- Podman and podman-compose for rootless container management.
- The two-tier local stack: base infrastructure and optional LGTM observability.
- How to verify that every service is healthy and ready.

Next, we'll meet the shipping domain that drives every example in this tutorial — the five services, the data model, and how they collaborate through messaging.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: SDKMAN install commands work on a clean machine; `setup-stack.sh` brings all containers to healthy on Podman 5.x; PostgreSQL init-schemas.sql creates all five schemas; Apicurio health endpoint responds at 8081.*
