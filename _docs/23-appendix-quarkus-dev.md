---
title: "Appendix E: Quarkus Dev Mode"
order: 23
part: appendices
description: "Dev services, continuous testing, live reload, and the JBang-to-Quarkus promotion workflow."
duration: "25 minutes"
---

Quarkus Dev Mode is where JBang prototyping meets production-grade development. This appendix covers the features that make Camel Quarkus development fast: automatic infrastructure provisioning, live code reload, continuous testing, and the Dev UI.

## Dev Services — automatic infrastructure

When you run `mvn quarkus:dev`, Quarkus Dev Services automatically starts containers for your dependencies. No Podman compose needed during development:

```properties
# application.properties — Dev Services start these automatically
# Kafka: starts a Redpanda container on a random port
%dev.kafka.bootstrap.servers=localhost:9092
# PostgreSQL: starts a PostgreSQL container
%dev.quarkus.datasource.db-kind=postgresql
%dev.quarkus.datasource.devservices.enabled=true
# Redis: starts a Redis container
%dev.quarkus.redis.devservices.enabled=true
```

When you run in dev mode, Quarkus:
1. Detects `camel-quarkus-kafka` in your POM → starts a Kafka broker.
2. Detects `quarkus-jdbc-postgresql` → starts a PostgreSQL instance and runs `init-schemas.sql`.
3. Detects `quarkus-redis-client` → starts a Redis instance.

All containers are cleaned up when dev mode exits.

### Dev Services configuration

You can customize the containers that Dev Services provisions:

```properties
# Pin a specific image version for reproducibility
%dev.quarkus.datasource.devservices.image-name=postgres:16
%dev.quarkus.kafka.devservices.image-name=vectorized/redpanda:v24.1.1

# Pre-load SQL scripts on startup
%dev.quarkus.datasource.devservices.init-script-path=init-schemas.sql

# Expose a fixed port (instead of random) for external tool access
%dev.quarkus.datasource.devservices.port=5432
```

### Shared Dev Services

Multiple services can share the same Dev Services container by setting `%dev.quarkus.kafka.devservices.service-name=shared-kafka` — services with the same `service-name` reuse one container. This lets you run `mvn quarkus:dev` in two terminals with both services on the same broker.

### When to use Dev Services vs. the Podman stack

| Scenario | Use |
|----------|-----|
| Single-service development | Dev Services (automatic, zero config) |
| Multi-service integration testing | Podman stack (shared Kafka across services) |
| Full-stack demo | Podman stack + LGTM overlay |
| CI/CD | Podman stack (reproducible) |

## Live reload

In dev mode, Quarkus watches for file changes and reloads automatically:

```bash
mvn quarkus:dev
# Change a Java file → Quarkus recompiles and restarts in ~1 second
# Change application.properties → Quarkus reloads configuration
# Change a resource file → Quarkus picks it up on next request
```

The reload is triggered on the next HTTP request or message consumption — Quarkus does not restart eagerly. This means you can save multiple files before triggering a rebuild, and only one restart happens.

### Camel route reload

Camel routes defined in Java DSL require a full Quarkus restart on change, but Quarkus's fast restart (~1s on a warm JVM) makes this nearly transparent. The CamelContext is stopped, rebuilt with the updated route definitions, and restarted. Change a `.to()` destination, save, and the next message triggers a restart with the updated route.

### The `--dev` flag: JBang vs. Quarkus

| Feature | `camel run --dev` (JBang) | `mvn quarkus:dev` (Quarkus) |
|---------|--------------------------|----------------------------|
| Startup time | ~2 seconds | ~3-5 seconds |
| Route reload | Hot reload YAML/Java | Hot reload + full rebuild |
| Dev Services | None (use compose) | Automatic containers |
| Debugging | Limited | Full IDE debugging |
| Testing | Manual | Continuous testing |
| Production path | Export with `camel export` | Direct build |

## Configuration profiles

Quarkus uses configuration profiles to manage environment-specific settings. The `%profile.` prefix scopes a property to a specific profile:

```properties
# application.properties

# Dev profile — used by mvn quarkus:dev
%dev.kafka.bootstrap.servers=localhost:9092
%dev.quarkus.log.level=DEBUG
%dev.camel.context.name=order-service-dev

# Test profile — used by mvn test and continuous testing
%test.kafka.bootstrap.servers=localhost:9092
%test.quarkus.log.level=INFO
%test.camel.context.name=order-service-test

# Production — no prefix (default)
kafka.bootstrap.servers=${KAFKA_BOOTSTRAP_SERVERS}
quarkus.log.level=WARN
camel.context.name=order-service
```

The active profile is determined automatically: `mvn quarkus:dev` activates `%dev`, `mvn test` activates `%test`, and `java -jar` or a native binary uses the unprefixed defaults. Custom profiles can be activated with `-Dquarkus.profile=staging`.

## Continuous testing

Quarkus runs tests automatically as you code:

```bash
mvn quarkus:dev
# Press 'r' to toggle continuous testing
# Tests re-run automatically on every code change
```

Only tests affected by the changed code are re-run — Quarkus tracks which classes each test touches and runs the minimal set. This makes continuous testing practical even with a large test suite.

With Camel test utilities:

```java
@QuarkusTest
public class OrderRouteTest {

    @Inject
    ProducerTemplate producer;

    @Inject
    CamelContext camelContext;

    @Test
    void testOrderRouting() {
        // Camel route is already started by Quarkus
        MockEndpoint mock = camelContext.getEndpoint("mock:result", MockEndpoint.class);
        mock.expectedMessageCount(1);

        producer.sendBody("direct:create-order",
            Map.of("order_id", 42, "amount", 149.99));

        mock.assertIsSatisfied();
    }
}
```

### Replacing endpoints for testing

Use `AdviceWith` to swap real endpoints (Kafka, HTTP) for mocks during tests without changing route code:

```java
@QuarkusTest
public class OrderEnrichmentRouteTest {

    @Inject CamelContext camelContext;
    @Inject ProducerTemplate producer;

    @Test
    void testEnrichmentWithMockedKafka() throws Exception {
        AdviceWith.adviceWith(camelContext, "order-enrichment", route -> {
            route.replaceFromWith("direct:test-input");
            route.interceptSendToEndpoint("kafka:*")
                .skipSendToOriginalEndpoint()
                .to("mock:kafka-output");
        });

        MockEndpoint mock = camelContext.getEndpoint(
            "mock:kafka-output", MockEndpoint.class);
        mock.expectedMessageCount(1);
        producer.sendBody("direct:test-input",
            "{\"order_id\": 42, \"amount\": 149.99}");
        mock.assertIsSatisfied();
    }
}
```

## Dev UI dashboard

The Quarkus Dev UI is available at `http://localhost:8080/q/dev-ui` during dev mode. It provides a browser-based dashboard for inspecting and managing your running application.

### Camel extensions in Dev UI

When `camel-quarkus-core` is on the classpath, the Dev UI includes Camel-specific panels:

- **Routes** — Lists all active routes with their status (Started/Stopped), message counts, and processing times. You can stop and restart individual routes without restarting the application.
- **Endpoints** — Shows every endpoint registered in the CamelContext — useful for verifying that Kafka topics, direct endpoints, and timers are wired correctly.
- **Type Converters** — Lists all registered type converters, helpful when debugging marshalling issues.
- **Components** — Shows which Camel components are loaded and their configuration properties.

Other useful panels include **Configuration** (all properties and effective values), **Continuous Testing** (results and affected-test tracking), **Dev Services** (running containers and connection strings), and **Health** (liveness/readiness probes reflecting Camel route health).

## Debugging Camel routes in dev mode

### IDE debugging

Quarkus dev mode supports remote debugging on port 5005 out of the box. Run `mvn quarkus:dev -Ddebug` (or `-Ddebug=5006` for a custom port), then attach your IDE. Set breakpoints in route builders, processors, or bean methods to inspect the exchange's headers, body, and properties mid-flight.

### Camel route tracing

Enable Camel's exchange tracer to log every step a message takes through a route:

```properties
%dev.camel.main.tracing=true
%dev.camel.main.tracing-pattern=order-*
```

This logs each processor the exchange passes through, including headers and body. Restrict with `tracing-pattern` to avoid noise from timer and health check routes.

## Common pitfalls

**Port conflicts with Dev Services** — If the Podman stack is already running, Dev Services will try to start duplicate containers. Disable Dev Services for the conflicting service:

```properties
%dev.quarkus.kafka.devservices.enabled=false
%dev.kafka.bootstrap.servers=localhost:9092
```

**Stale CamelContext after refactoring** — Renaming a `RouteBuilder` class sometimes leaves the old route registered alongside the new one. Press `s` in the dev mode terminal to force a full restart, or stop and restart dev mode entirely.

**Orphaned containers** — If dev mode is killed with `kill -9` instead of `Ctrl+C`, Dev Services containers are not cleaned up. Remove them with `podman rm -f $(podman ps -q --filter label=quarkus-dev-service)`.

**Native build differences** — Code that works in dev mode may fail in a native build due to GraalVM restrictions. Custom processors that use reflection need `@RegisterForReflection`; Camel Quarkus extensions handle most reflection registration automatically. Test periodically with `mvn package -Dnative`.

## The promotion workflow

{% include excalidraw.html file="23-promotion-workflow" alt="JBang to Quarkus promotion workflow" caption="Figure N.1 — From JBang prototype to native Quarkus binary" %}

```bash
# Step 1: Prototype
camel run order-router.yaml --dev

# Step 2: Promote
camel export --runtime=quarkus --directory=order-service order-router.yaml

# Step 3: Develop
cd order-service
mvn quarkus:dev

# Step 4: Package for production
mvn package -Dnative -Dquarkus.container-image.build=true
```

The native build produces a GraalVM native image: ~20ms startup, ~50MB memory. Ideal for Kubernetes deployments where fast scaling matters.

---

*Verification status: <span class="status status--verified">verified</span> — conceptual reference chapter, no runnable example.*
