---
title: "Appendix U: Camel CLI Deep Dive"
order: 39
part: appendices
description: "A comprehensive guide to the Camel CLI — prototyping routes with camel run, tracing exchanges, debugging, managing infrastructure, and exporting to production runtimes."
duration: "35 minutes"
---

Every YAML DSL example in this tutorial uses a single command to run: `camel run *.yaml`. That command is the entry point to the Camel CLI — a tool that serves two distinct roles. First, it is a **prototyping runtime**: write a YAML route file, run it, and you have a live integration in seconds with no Maven project, no pom.xml, no build step. Second, it is a **management tool**: inspect running Camel applications, trace live exchanges, check health, and monitor Kafka consumer lag — regardless of whether the application was started from the CLI or deployed as a Quarkus or Spring Boot service.

This appendix covers both roles in depth. By the end you will know how to prototype a route, debug it interactively, and export it into a production-ready Maven project — the complete lifecycle from idea to deployment.

The code is in `examples/39-camel-cli/`.

```bash
camel run *.yaml
```

{% include excalidraw.html file="39-camel-cli-workflow" alt="Camel CLI prototype-to-production workflow" caption="Figure U.1 — The Camel CLI lifecycle: prototype with camel run, inspect with camel trace, export to a production Maven project." %}

## Installation

The Camel CLI is distributed through [JBang](https://www.jbang.dev/), a tool that runs Java programs without requiring a project setup. Install JBang first, then install the Camel CLI as a JBang application:

```bash
# Install JBang (if not already installed)
curl -Ls https://sh.jbang.dev | bash -s - app setup

# Install the Camel CLI
jbang app install camel@apache/camel
```

Verify the installation:

```bash
camel version
```

```
Apache Camel CLI 4.20.0
```

The CLI ships as a single binary that delegates to JBang under the hood. When you run `camel run`, JBang resolves Camel dependencies, downloads them once, caches them locally, and starts the Camel runtime — no Maven, Gradle, or IDE required.

### Upgrading

To upgrade the CLI after a new Camel release:

```bash
jbang app install --force camel@apache/camel
```

This pulls the latest version from the Apache Camel GitHub repository and replaces the cached binary. Verify with `camel version` to confirm the upgrade.

## Running routes

The `camel run` command is the workhorse. Point it at one or more YAML, Java, or XML route files and it starts a Camel runtime with those routes loaded:

```bash
# Run a single route file
camel run order-router.yaml

# Run all YAML files in the current directory
camel run *.yaml

# Run with dev mode — live reload on file changes
camel run --dev *.yaml
```

### How dependency resolution works

When the CLI parses your route file, it detects which Camel components you reference — `kafka:`, `redis-lettuce:`, `rest:`, `json` marshalling — and resolves the corresponding Maven artifacts automatically. You never declare dependencies in a pom.xml. The CLI's dependency resolver handles:

| Component reference | Resolved artifact |
|---------------------|-------------------|
| `kafka:eip.orders.express` | `camel-kafka` |
| `redis-lettuce:localhost:6379` | `camel-redis-lettuce` |
| `rest:` configuration | `camel-rest`, `camel-platform-http` |
| `json` marshal/unmarshal | `camel-jackson` |

This is the key advantage for prototyping. Add a `to: "slack:#alerts"` step to your route, and the CLI downloads `camel-slack` without any configuration change.

### The example routes

The example directory contains two routes that demonstrate a content-based router and an enricher — two patterns covered in Chapters 9 and 10 — wired together through Kafka.

**order-router.yaml** — A REST API that accepts POST requests on `/api/orders` and routes each order to a Kafka topic based on the `orderType` header:

```yaml
# REST API that accepts order submissions and routes each order
# to a Kafka topic determined by its orderType header —
# EXPRESS, STANDARD, or BULK.
- rest:
    path: /api/orders
    post:
      - to: "direct:route-order"
      - consumes: application/json
        produces: application/json

- route:
    id: route-order
    from:
      uri: "direct:route-order"
    steps:
      - unmarshal:
          json:
            library: Jackson
      - log: "Order received: ${body[orderId]} — type: ${header.orderType}"
      - choice:
          when:
            - simple: "${header.orderType} == 'EXPRESS'"
              steps:
                - log: "EXPRESS order ${body[orderId]} → express topic"
                - to:
                    uri: "kafka:eip.orders.express"
                    parameters:
                      brokers: "{{camel.component.kafka.brokers}}"
            - simple: "${header.orderType} == 'BULK'"
              steps:
                - log: "BULK order ${body[orderId]} → bulk topic"
                - to:
                    uri: "kafka:eip.orders.bulk"
                    parameters:
                      brokers: "{{camel.component.kafka.brokers}}"
          otherwise:
            steps:
              - log: "STANDARD order ${body[orderId]} → standard topic"
              - to:
                  uri: "kafka:eip.orders.standard"
                  parameters:
                    brokers: "{{camel.component.kafka.brokers}}"
```

**order-enricher.yaml** — Consumes express orders from Kafka, looks up customer data in Redis, and publishes the enriched order downstream:

```yaml
# Consumes express orders from Kafka, enriches each order with
# customer data retrieved from Redis, and publishes the enriched
# order to a downstream topic.
- route:
    id: order-enricher
    from:
      uri: "kafka:eip.orders.express"
      parameters:
        brokers: "{{camel.component.kafka.brokers}}"
        groupId: "{{camel.component.kafka.group-id}}"
    steps:
      - unmarshal:
          json:
            library: Jackson
      - log: "Enriching express order ${body[orderId]} for customer ${body[customerId]}"
      - setHeader:
          name: RedisKey
          simple: "customer:${body[customerId]}"
      - toD:
          uri: "redis-lettuce:{{camel.component.redis-lettuce.host}}:{{camel.component.redis-lettuce.port}}?command=GET&key=${header.RedisKey}"
      - setHeader:
          name: customerName
          jsonpath: "$.name"
      - setHeader:
          name: customerTier
          jsonpath: "$.tier"
      - log: "Enriched order ${body[orderId]} — customer: ${header.customerName}, tier: ${header.customerTier}"
      - marshal:
          json:
            library: Jackson
      - to:
          uri: "kafka:eip.orders.enriched"
          parameters:
            brokers: "{{camel.component.kafka.brokers}}"
```

### Configuration

Properties go in `application.properties` in the same directory. The CLI loads this file automatically:

```properties
# Kafka
camel.component.kafka.brokers=localhost:9092
camel.component.kafka.group-id=eip-cli-demo

# Redis
camel.component.redis-lettuce.host=localhost
camel.component.redis-lettuce.port=6379

# REST
camel.rest.port=8088
camel.rest.binding-mode=json
```

### Dev mode

The `--dev` flag enables live reload. When you save a change to any route file or `application.properties`, the CLI detects the modification, stops the running routes, reloads the files, and restarts — all within a second or two:

```bash
camel run --dev *.yaml
```

Dev mode also enables the developer console (covered next) and makes `camel trace` output more detailed. It is the recommended way to run during development.

You can also use the `camel dev` alias, which is equivalent to `camel run --dev`:

```bash
camel dev *.yaml
```

### OpenAPI generation

If your route defines a REST DSL configuration, the CLI can generate an OpenAPI specification:

```bash
camel run --open-api order-router.yaml
```

This starts the route and serves the generated OpenAPI document at `http://localhost:8088/api-docs`. Useful for sharing an API contract with frontend teams while the route is still a prototype.

## Developer console

When running in dev mode, the CLI starts a developer console on port 8080. Open `http://localhost:8080/q/dev` in a browser to see:

| Section | What it shows |
|---------|---------------|
| **Routes** | All loaded routes with their status (Started, Stopped), uptime, and exchange counters |
| **Endpoints** | Every endpoint URI in use — Kafka topics, REST paths, Redis connections — with message counts |
| **Health** | Readiness and liveness checks — Kafka broker connectivity, Redis connection pool status |
| **Statistics** | Per-route performance: total exchanges, failed exchanges, mean processing time, last processing time |
| **Properties** | Resolved configuration properties and their sources |

The console refreshes automatically. It is a lightweight alternative to connecting JMX or an observability stack when you just need a quick status check during prototyping.

The console URL follows the Quarkus convention (`/q/dev`) because the Camel CLI uses Quarkus as its underlying runtime. This also means that Quarkus Dev UI extensions work with CLI-launched routes.

## Tracing and debugging

### Tracing exchanges

The `camel trace` command attaches to a running Camel integration and displays exchanges flowing through routes in real time. Open a second terminal while your routes are running:

```bash
camel trace
```

Output is a live-updating table:

```
 PID   NAME            ROUTE           NODE                 ELAPSED  STATUS  BODY
 1234  order-router    route-order     unmarshal1           2ms      ✔       {"orderId":"ORD-9001","item":"Wi...
 1234  order-router    route-order     log1                 0ms      ✔       {"orderId":"ORD-9001","item":"Wi...
 1234  order-router    route-order     choice1              1ms      ✔       {"orderId":"ORD-9001","item":"Wi...
 1234  order-router    route-order     toKafkaExpress       15ms     ✔       {"orderId":"ORD-9001","item":"Wi...
 1234  order-enricher  order-enricher  unmarshal2           1ms      ✔       {"orderId":"ORD-9001","customerId...
 1234  order-enricher  order-enricher  toRedis1             8ms      ✔       {"name":"Acme Corp","tier":"GOLD"}
 1234  order-enricher  order-enricher  toKafkaEnriched      12ms     ✔       {"orderId":"ORD-9001","customerNa...
```

Each row is a processing step. The ELAPSED column shows how long that step took, making it easy to spot slow processors — a Kafka produce that takes 200ms, a Redis lookup timing out, or a marshalling step that is unexpectedly expensive.

#### Filtering traces

You can filter traces to a specific route:

```bash
# Trace only the enricher route
camel trace --filter=order-enricher
```

Or limit to failed exchanges:

```bash
camel trace --filter=fail
```

### Debugging with breakpoints

The `camel debug` command provides step-by-step debugging. Set a breakpoint on a route node and the CLI pauses execution when an exchange reaches that point:

```bash
camel debug
```

Once attached, the debugger shows an interactive prompt:

```
camel debug> breakpoint route-order choice1
Breakpoint set on route-order/choice1

camel debug> resume
Waiting for exchange...

Exchange hit breakpoint at route-order/choice1
  Exchange ID: 1A2B3C4D-5E6F
  Body: {"orderId":"ORD-9001","item":"Wireless Headphones","quantity":2}
  Headers:
    orderType = EXPRESS
    Content-Type = application/json

camel debug> step
  Stepped to: toKafkaExpress
  Body: {"orderId":"ORD-9001","item":"Wireless Headphones","quantity":2}

camel debug> continue
```

Debugging is particularly useful when a content-based router is not matching the branch you expect — you can inspect the exact header values and body content at the decision point.

## Inspecting running integrations

The CLI includes a set of `camel get` and `camel ps` commands for inspecting running Camel applications. These commands work against any Camel application that has the `camel-management` component enabled — not just CLI-launched routes. This means you can use them to inspect Quarkus and Spring Boot applications too.

### Listing running integrations

```bash
camel ps
```

```
 PID   NAME            CAMEL    RUNTIME  UPTIME   ROUTES  STATUS
 1234  order-router    4.20.0   cli      12m 30s  2       Running
 5678  shipping-svc    4.20.0   quarkus  2h 15m   8       Running
```

### Route status

```bash
camel get routes
```

```
 PID   ROUTE           STATUS   UPTIME   TOTAL  FAILED  INFLIGHT  MEAN    LAST
 1234  route-order     Started  12m 30s  47     0       0         18ms    12ms
 1234  order-enricher  Started  12m 30s  15     1       0         32ms    28ms
```

The TOTAL, FAILED, and INFLIGHT columns give you a quick operational picture. A rising FAILED count or a non-zero INFLIGHT with increasing MEAN time signals trouble.

### Health checks

```bash
camel get health
```

```
 PID   CHECK                STATUS  MESSAGE
 1234  camel/context        UP      CamelContext is started
 1234  camel/routes         UP      2/2 routes started
 1234  kafka/eip.orders.*   UP      Connected to localhost:9092
 1234  redis                UP      Connected to localhost:6379
```

Health checks are the CLI's equivalent of the `/q/health` endpoint in Quarkus. They verify that every external dependency — Kafka brokers, Redis, databases — is reachable.

### Kafka consumer lag

```bash
camel get kafka
```

```
 PID   TOPIC                   PARTITION  OFFSET  LAG  CONSUMER-GROUP
 1234  eip.orders.express      0          142     3    eip-cli-demo
 1234  eip.orders.standard     0          89      0    eip-cli-demo
 1234  eip.orders.bulk         0          23      0    eip-cli-demo
```

A LAG value greater than zero means the consumer is falling behind the producer. This is the same information you would get from `kafka-consumer-groups.sh --describe`, but scoped to the routes in your integration and available without connecting to the Kafka broker directly.

### Endpoint statistics

```bash
camel get endpoint
```

```
 PID   URI                           DIRECTION  TOTAL  FAILED  LAST
 1234  kafka:eip.orders.express      InOut       47     0       12ms ago
 1234  kafka:eip.orders.standard     Out         32     0       45s ago
 1234  kafka:eip.orders.bulk         Out         15     0       2m ago
 1234  redis-lettuce:localhost:6379  InOut       15     1       28ms ago
 1234  kafka:eip.orders.enriched     Out         14     0       28ms ago
```

## Infrastructure services

The CLI can spin up infrastructure containers for local development using Testcontainers. This is useful when you want to prototype a route without running the full Podman stack from `scripts/setup-stack.sh`.

### Listing available services

```bash
camel infra list
```

```
 SERVICE          IMAGE                                 PORT
 kafka            apache/kafka:latest                   9092
 redis            redis:7                               6379
 postgres         postgres:17                           5432
 activemq         apache/activemq-artemis:latest        61616
 mongodb          mongo:7                               27017
 minio            minio/minio:latest                    9000
 elasticsearch    elastic/elasticsearch:8.17.0           9200
 rabbitmq         rabbitmq:4-management                 5672
```

### Starting a service

```bash
# Start a Kafka container
camel infra run kafka
```

The CLI pulls the container image (if not cached), starts it, and configures the Camel Kafka component to connect to it automatically. No `application.properties` change needed — the CLI injects the broker address.

You can start multiple services:

```bash
camel infra run kafka redis
```

This is the fastest path from zero to a working prototype. Write a route, run `camel infra run kafka`, and `camel run --dev *.yaml` — three commands to a live integration with real infrastructure.

### How it relates to the Podman stack

The `camel infra` containers are ephemeral — data is lost when you stop them. For persistent development environments, use the Podman stack (`./scripts/setup-stack.sh`) described in Chapter 0. The CLI containers are best for quick experiments and throwaway prototypes.

## Interactive shell

The `camel shell` command opens an interactive REPL with tab completion and command history:

```bash
camel shell
```

```
Apache Camel CLI (shell)
Type 'help' for available commands.

camel> run order-router.yaml
Started route: route-order

camel> get routes
 ROUTE           STATUS   UPTIME  TOTAL  FAILED
 route-order     Started  10s     0      0

camel> trace
 Waiting for exchanges...
```

### Tab completion

The shell supports tab completion for commands, sub-commands, and file names:

```
camel> get <TAB>
routes    health    kafka     endpoint  context

camel> run ord<TAB>
order-router.yaml    order-enricher.yaml
```

### Watch mode

Within the shell, you can prefix any `get` command with `--watch` to refresh the output periodically:

```
camel> get routes --watch
```

This turns the terminal into a live dashboard — route statistics update every two seconds. Press `Ctrl+C` to stop watching.

The shell is useful for interactive exploration during development. Rather than switching between terminal tabs to run `camel trace`, `camel get routes`, and `camel run`, you stay in one session and iterate.

## Exporting to production runtimes

This is the most powerful feature of the CLI: taking a set of YAML route files that you prototyped with `camel run` and generating a complete, production-ready Maven project.

### Export to Quarkus

```bash
camel export --runtime=quarkus \
  --gav=com.eipbook:order-router:1.0 \
  --directory=order-router-quarkus
```

This generates:

```
order-router-quarkus/
├── pom.xml
├── src/
│   └── main/
│       ├── resources/
│       │   ├── application.properties
│       │   └── camel/
│       │       ├── order-router.yaml
│       │       └── order-enricher.yaml
│       └── java/
│           └── (empty — routes are YAML)
```

The generated `pom.xml` includes:

- Quarkus BOM at the correct version
- `camel-quarkus-kafka`, `camel-quarkus-redis-lettuce`, `camel-quarkus-rest`, `camel-quarkus-jackson` — every component detected from your route files
- `camel-quarkus-yaml-dsl` for YAML route loading
- The Quarkus Maven plugin with `quarkus:dev` and native build profiles

Your `application.properties` is migrated from the CLI format to Quarkus format. YAML route files are copied into `src/main/resources/camel/`, which is where Camel Quarkus auto-discovers them at startup.

Run the exported project immediately:

```bash
cd order-router-quarkus
mvn quarkus:dev
```

### Export to Spring Boot

```bash
camel export --runtime=spring-boot \
  --gav=com.eipbook:order-router:1.0 \
  --directory=order-router-spring-boot
```

The structure is identical but the `pom.xml` references the Spring Boot starter BOM and `camel-spring-boot` dependencies instead of Quarkus extensions. The same YAML route files work on both runtimes without modification.

Run the Spring Boot variant:

```bash
cd order-router-spring-boot
mvn spring-boot:run
```

### What changes and what stays the same

| Aspect | CLI prototype | Exported project |
|--------|---------------|------------------|
| **Route files** | `order-router.yaml` in working directory | `src/main/resources/camel/order-router.yaml` |
| **Dependencies** | Auto-resolved at startup | Declared in `pom.xml` |
| **Configuration** | `application.properties` in working directory | `src/main/resources/application.properties` |
| **Container image** | Not applicable | `mvn package` produces a container-ready JAR |
| **Native compilation** | Not supported | Quarkus: `mvn package -Dnative` |
| **Health checks** | CLI built-in | Quarkus SmallRye Health / Spring Boot Actuator |

The route logic does not change. The YAML files are byte-for-byte identical. What changes is the runtime plumbing — dependency management, health endpoints, metrics, container image builds — which is exactly the plumbing that Quarkus and Spring Boot provide.

### Export options

| Flag | Description | Example |
|------|-------------|---------|
| `--runtime` | Target runtime: `quarkus`, `spring-boot`, `main` (standalone Camel Main) | `--runtime=quarkus` |
| `--gav` | Maven group:artifact:version | `--gav=com.eipbook:order-router:1.0` |
| `--directory` | Output directory (default: current directory) | `--directory=./exported` |
| `--quarkus-version` | Override the Quarkus BOM version | `--quarkus-version=3.37.0` |
| `--spring-boot-version` | Override the Spring Boot BOM version | `--spring-boot-version=4.0.7` |
| `--camel-version` | Override the Camel version | `--camel-version=4.20.0` |
| `--package-name` | Java package for generated classes | `--package-name=com.eipbook.router` |
| `--fresh` | Delete existing target directory before export | `--fresh` |

## The update command

Camel evolves rapidly — new components, deprecated APIs, breaking changes between major versions. The `camel update` command helps you keep your routes current.

### Checking for updates

```bash
camel update list
```

```
 CHECK                    STATUS    DETAIL
 Camel version            UPDATE    4.19.0 → 4.20.0
 Deprecated API usage     WARNING   toD() with simple language — use to() with dynamic URI
 Removed component        OK        No removed components in use
 Property migration       WARNING   camel.component.kafka.brokerList → camel.component.kafka.brokers
```

### Applying updates

```bash
camel update run
```

This applies [OpenRewrite](https://docs.openrewrite.org/) recipes to your route files and configuration. OpenRewrite is a source-code transformation engine — it parses your files, applies migration rules, and writes back the modified source. The CLI bundles Camel-specific recipes for each version upgrade.

What `camel update run` can do:

- Rename deprecated properties (`brokerList` to `brokers`)
- Update component URIs when component names change
- Replace deprecated EIP options with their successors
- Adjust YAML DSL syntax for breaking changes between Camel versions

What it cannot do:

- Refactor custom Java processors
- Migrate custom CDI beans
- Update third-party library dependencies

For major version upgrades (3.x to 4.x), the CLI's recipes handle the bulk of the mechanical changes. You still need to review the migration guide for semantic changes — behavior differences that cannot be detected from syntax alone.

## Plugins

The CLI architecture is extensible through plugins. Plugins add new top-level commands to the `camel` CLI.

### Installing plugins

```bash
# Add Kubernetes commands
camel plugin add kubernetes

# Add Citrus testing support
camel plugin add test

# List installed plugins
camel plugin list
```

### Kubernetes plugin

The Kubernetes plugin adds commands for deploying and managing Camel integrations on Kubernetes directly from the CLI:

```bash
# Deploy a route to the current Kubernetes context
camel kubernetes run order-router.yaml

# View logs from the deployed pod
camel kubernetes logs order-router

# Delete the deployment
camel kubernetes delete order-router
```

This plugin works by running `camel export --runtime=quarkus` behind the scenes, building a container image, and deploying it to the cluster. It is a convenience wrapper — for production deployments, use the explicit export-and-deploy workflow described in Appendix T.

### Test plugin

The test plugin integrates [Citrus](https://citrusframework.org/) test capabilities into the CLI:

```bash
camel test order-router-test.yaml
```

Citrus tests can verify that a route produces the expected output for a given input, assert header values, and validate message content — all from YAML test definitions without writing Java. See Appendix W for a full treatment of Camel testing with Citrus.

## Command reference

A complete reference of CLI commands, grouped by category.

### Running and development

| Command | Description |
|---------|-------------|
| `camel run <files>` | Run routes from YAML, Java, or XML files |
| `camel dev <files>` | Alias for `camel run --dev` — run with live reload |
| `camel run --dev <files>` | Run with live reload, developer console, and enhanced tracing |
| `camel run --open-api <files>` | Run and serve generated OpenAPI specification |
| `camel shell` | Enter interactive shell with tab completion |
| `camel version` | Print the installed Camel CLI version |

### Inspection and monitoring

| Command | Description |
|---------|-------------|
| `camel ps` | List all running Camel integrations |
| `camel get routes` | Show route status, exchange counts, and processing times |
| `camel get health` | Display health check results for all integrations |
| `camel get kafka` | Show Kafka consumer lag per topic/partition |
| `camel get endpoint` | Show endpoint statistics — message counts and timing |
| `camel get context` | Display CamelContext details — version, uptime, component list |

### Tracing and debugging

| Command | Description |
|---------|-------------|
| `camel trace` | Trace live exchanges flowing through routes |
| `camel trace --filter=<route>` | Trace exchanges for a specific route |
| `camel trace --filter=fail` | Trace only failed exchanges |
| `camel debug` | Attach a step-by-step debugger to a running integration |

### Infrastructure

| Command | Description |
|---------|-------------|
| `camel infra list` | List available infrastructure services |
| `camel infra run <service>` | Start an infrastructure container (Kafka, Redis, etc.) |
| `camel infra stop <service>` | Stop a running infrastructure container |

### Exporting

| Command | Description |
|---------|-------------|
| `camel export --runtime=quarkus` | Export routes to a Quarkus Maven project |
| `camel export --runtime=spring-boot` | Export routes to a Spring Boot Maven project |
| `camel export --runtime=main` | Export routes to a standalone Camel Main project |

### Maintenance

| Command | Description |
|---------|-------------|
| `camel update list` | Check for available version updates and deprecated API usage |
| `camel update run` | Apply OpenRewrite migration recipes to route files |
| `camel plugin add <name>` | Install a CLI plugin |
| `camel plugin list` | List installed plugins |
| `camel plugin remove <name>` | Uninstall a CLI plugin |

### Kubernetes (plugin)

| Command | Description |
|---------|-------------|
| `camel kubernetes run <files>` | Deploy routes to the current Kubernetes context |
| `camel kubernetes logs <name>` | Stream logs from a deployed integration |
| `camel kubernetes delete <name>` | Delete a deployed integration |

## Prototype-to-production workflow

This section ties together everything in the appendix. Walk through the complete lifecycle using the shipping domain routes from `examples/39-camel-cli/`.

### Step 1: Write the routes

Create `order-router.yaml` with the REST API and content-based router. Create `order-enricher.yaml` with the Kafka consumer and Redis enricher. Create `application.properties` with broker and Redis connection details.

Three files, no build tooling, no pom.xml.

### Step 2: Start infrastructure

If you are not running the Podman stack, use the CLI to spin up Kafka and Redis:

```bash
camel infra run kafka redis
```

Or use the existing Podman stack:

```bash
./scripts/setup-stack.sh
```

### Step 3: Run in dev mode

```bash
camel run --dev *.yaml
```

The CLI resolves dependencies, starts the REST API on port 8088, connects to Kafka and Redis, and begins processing.

### Step 4: Test the routes

In a second terminal, submit an order:

```bash
curl -X POST http://localhost:8088/api/orders \
  -H "Content-Type: application/json" \
  -H "orderType: EXPRESS" \
  -d '{
    "orderId": "ORD-9001",
    "customerId": "CUST-42",
    "item": "Wireless Headphones",
    "quantity": 2
  }'
```

### Step 5: Trace exchanges

In a third terminal:

```bash
camel trace
```

Watch the exchange flow from the REST endpoint through the content-based router to the Kafka express topic, then from the express topic through the enricher to the enriched topic. Verify that the routing decision matches the `orderType` header.

### Step 6: Inspect route statistics

```bash
camel get routes
```

Confirm that both routes are started, check exchange counts, and verify no failures.

### Step 7: Iterate

Edit `order-router.yaml` — add a new branch for `PRIORITY` orders, change a log message, adjust the REST path. Dev mode detects the change and reloads within seconds. No restart, no rebuild.

### Step 8: Export to Quarkus

When the routes are working correctly:

```bash
camel export --runtime=quarkus \
  --gav=com.eipbook:order-router:1.0 \
  --directory=order-router-quarkus
```

### Step 9: Run as a Quarkus application

```bash
cd order-router-quarkus
mvn quarkus:dev
```

The same routes, the same behavior, now running on the Quarkus runtime with full access to Quarkus extensions, health endpoints, metrics, native compilation, and container image builds.

### Step 10: Deploy to Kubernetes

Follow Appendix T to build a container image, generate Kubernetes manifests, and deploy the exported project to Minikube or a production cluster.

---

The entire lifecycle — from a blank YAML file to a production Kubernetes deployment — uses the same route definitions. The CLI is the on-ramp: prototype fast, validate with tracing and inspection, and export when ready. The route logic never changes; only the runtime packaging evolves.

## Key takeaways

- **`camel run` is a zero-config runtime** — write a YAML route, run it, and dependencies are resolved automatically. No Maven project needed for prototyping.
- **`camel trace` is your primary debugging tool** — see every exchange, every routing decision, every processing step in real time. Filter by route or failure status.
- **`camel get` commands provide operational visibility** — route status, health checks, Kafka consumer lag, and endpoint statistics from the command line.
- **`camel infra` spins up infrastructure on demand** — Kafka, Redis, PostgreSQL containers without touching Docker Compose or Podman files.
- **`camel export` bridges prototype and production** — generate a complete Quarkus or Spring Boot Maven project from your YAML routes. Same route files, production-grade runtime.
- **`camel update` keeps routes current** — OpenRewrite recipes handle mechanical migration tasks when upgrading Camel versions.
- **The CLI inspects any Camel application** — not just CLI-launched routes. Use `camel ps`, `camel get`, and `camel trace` against Quarkus and Spring Boot services with the management component enabled.

## Further reading

- [Camel CLI documentation](https://camel.apache.org/manual/camel-jbang.html)
- [Camel YAML DSL reference](https://camel.apache.org/components/4.x/others/yaml-dsl.html)
- [JBang](https://www.jbang.dev/) — the Java runner that powers the CLI
- [OpenRewrite Camel recipes](https://docs.openrewrite.org/recipes/apache/camel)

---

*Verification status: unverified. CLI commands reference Apache Camel 4.20.0.*
