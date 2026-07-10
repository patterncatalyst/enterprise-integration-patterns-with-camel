---
title: "Appendix E: Quarkus Dev Mode"
order: 23
part: appendices
description: "Dev services, continuous testing, live reload, and the JBang-to-Quarkus promotion workflow."
duration: "15 minutes"
---

Quarkus Dev Mode is where JBang prototyping meets production-grade development. This appendix covers the features that make Camel Quarkus development fast: automatic infrastructure provisioning, live code reload, and continuous testing.

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
# Change a YAML route file → Camel reloads routes (no restart)
```

Camel routes defined in YAML files reload without restarting the application — the route is stopped, rebuilt from the new YAML, and started. Java DSL routes require a full restart, but Quarkus's fast restart (~1s on a warm JVM) makes this nearly transparent.

### The `--dev` flag: JBang vs. Quarkus

| Feature | `camel run --dev` (JBang) | `mvn quarkus:dev` (Quarkus) |
|---------|--------------------------|----------------------------|
| Startup time | ~2 seconds | ~3-5 seconds |
| Route reload | Hot reload YAML/Java | Hot reload + full rebuild |
| Dev Services | None (use compose) | Automatic containers |
| Debugging | Limited | Full IDE debugging |
| Testing | Manual | Continuous testing |
| Production path | Export with `camel export` | Direct build |

## Continuous testing

Quarkus runs tests automatically as you code:

```bash
mvn quarkus:dev
# Press 'r' to toggle continuous testing
# Tests re-run automatically on every code change
```

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

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Quarkus Dev Services auto-start containers for Kafka, PostgreSQL, and Redis; `camel export --runtime=quarkus` generates a Quarkus project; continuous testing toggle with 'r' key works in `mvn quarkus:dev`; native image build command is correct.*
