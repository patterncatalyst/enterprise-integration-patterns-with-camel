---
title: "Appendix A: Camel on Spring Boot vs Quarkus"
order: 19
part: appendices
description: "Java DSL with Spring Boot (Camel Spring Boot) vs Quarkus (Camel Quarkus) — DI models, configuration, testing, deployment, and the Spring XML DSL."
duration: "25 minutes"
---

This tutorial uses Camel Quarkus exclusively — but most Camel content in the wild targets Spring Boot. If you're coming from Camel Spring Boot, or evaluating which runtime to adopt, this appendix maps the differences: how routes are registered, how configuration works, how testing differs, and what Spring's XML DSL offers that the Java DSL doesn't (and vice versa).

## Two runtimes, one Camel

Apache Camel's core — the route engine, EIP processors, components, and Java DSL — is runtime-agnostic. `RouteBuilder`, `from()`, `to()`, `choice()`, `split()`, `aggregate()` all work identically on both runtimes. What differs is the integration layer: how Camel discovers routes, injects dependencies, manages configuration, and starts up.

| Aspect | Camel Spring Boot | Camel Quarkus |
|--------|-------------------|---------------|
| **DI framework** | Spring (annotations, `@Autowired`) | CDI (annotations, `@Inject`) |
| **Route discovery** | Spring component scanning | CDI bean discovery |
| **Configuration** | `application.properties` / `application.yml` | `application.properties` (MicroProfile Config) |
| **Auto-configuration** | Spring Boot starters (`camel-spring-boot-starter`) | Quarkus extensions (`camel-quarkus-core`) |
| **Dev mode** | Spring DevTools (restart) | Quarkus dev mode (hot reload, Dev Services) |
| **Testing** | `@SpringBootTest` + `CamelSpringBootRunner` | `@QuarkusTest` + CDI injection |
| **Native compilation** | Spring AOT + GraalVM (experimental) | GraalVM native (mature, production-ready) |
| **Startup time (JVM)** | ~3-8 seconds | ~1-3 seconds |
| **Startup time (native)** | ~200-500ms | ~15-50ms |
| **Memory (JVM)** | ~200-400MB | ~100-200MB |
| **Memory (native)** | ~80-150MB | ~30-60MB |

## Route registration

### Spring Boot

In Camel Spring Boot, `RouteBuilder` classes are Spring components discovered by component scanning:

```java
@Component
public class OrderRoutes extends RouteBuilder {

    @Autowired
    private OrderValidator validator;

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=inventory")
            .routeId("inventory-check")
            .unmarshal().json(Map.class)
            .bean(validator, "validate")
            .choice()
                .when(header("valid").isEqualTo(true))
                    .to("kafka:eip.inventory.reserved?brokers={{kafka.brokers}}")
                .otherwise()
                    .to("kafka:eip.orders.invalid?brokers={{kafka.brokers}}")
            .end();
    }
}
```

Key Spring-isms:
- `@Component` makes the route discoverable via Spring scanning.
- `@Autowired` injects Spring beans.
- `{{kafka.brokers}}` resolves from Spring's `Environment` (application.properties/yml).
- The `CamelAutoConfiguration` starter wires everything: creates the `CamelContext`, discovers routes, starts them.

### Quarkus (this tutorial)

In Camel Quarkus, `RouteBuilder` classes are CDI beans:

```java
@ApplicationScoped
public class OrderRoutes extends RouteBuilder {

    @Inject
    OrderValidator validator;

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=inventory")
            .routeId("inventory-check")
            .unmarshal().json(Map.class)
            .bean(validator, "validate")
            .choice()
                .when(header("valid").isEqualTo(true))
                    .to("kafka:eip.inventory.reserved?brokers={{kafka.brokers}}")
                .otherwise()
                    .to("kafka:eip.orders.invalid?brokers={{kafka.brokers}}")
            .end();
    }
}
```

Key CDI-isms:
- `@ApplicationScoped` makes the route a CDI bean (singleton scope).
- `@Inject` replaces `@Autowired`.
- `{{kafka.brokers}}` resolves from MicroProfile Config (also `application.properties`).
- Camel Quarkus auto-discovers `RouteBuilder` beans via CDI, creates the `CamelContext`, starts routes.

**The route body is identical.** Only the DI annotations differ.

## Configuration

### Spring Boot

```yaml
# application.yml (Spring style)
camel:
  springboot:
    name: order-service
    main-run-controller: true
  component:
    kafka:
      brokers: localhost:9092
      schema-registry-url: http://localhost:8081

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders
    password: orders123

# Custom properties
kafka:
  brokers: localhost:9092

order-service:
  max-retries: 3
  timeout-ms: 5000
```

Spring Boot supports both `.properties` and `.yml`. Camel Spring Boot binds component configuration with the `camel.component.<name>.<property>` prefix.

### Quarkus

```properties
# application.properties (Quarkus style)
quarkus.application.name=order-service

# Kafka (Camel component properties)
camel.component.kafka.brokers=localhost:9092
camel.component.kafka.schema-registry-url=http://localhost:8081

# Datasource
quarkus.datasource.db-kind=postgresql
quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/orders
quarkus.datasource.username=orders
quarkus.datasource.password=orders123

# Custom properties
kafka.brokers=localhost:9092
order-service.max-retries=3
order-service.timeout-ms=5000

# Profile-specific (dev only)
%dev.kafka.brokers=localhost:9092
%dev.quarkus.datasource.devservices.enabled=true
```

Quarkus uses `.properties` by default (YAML support requires `quarkus-config-yaml`). Profile-specific config uses the `%profile.` prefix instead of Spring's `spring.profiles.active` + multi-document YAML.

### Configuration injection

Spring Boot:

```java
@Value("${order-service.max-retries}")
private int maxRetries;

@Value("${order-service.timeout-ms}")
private long timeoutMs;
```

Quarkus:

```java
@ConfigProperty(name = "order-service.max-retries")
int maxRetries;

@ConfigProperty(name = "order-service.timeout-ms")
long timeoutMs;
```

Both support type-safe configuration classes — Spring's `@ConfigurationProperties` maps to Quarkus's `@ConfigMapping`.

## The Spring XML DSL

Spring Boot has a unique DSL that Quarkus does not: routes defined as Spring XML beans. This is the oldest Camel route definition format, dating back to Camel 1.x:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="
         http://www.springframework.org/schema/beans
         http://www.springframework.org/schema/beans/spring-beans.xsd
         http://camel.apache.org/schema/spring
         http://camel.apache.org/schema/spring/camel-spring.xsd">

  <camelContext id="orderContext" xmlns="http://camel.apache.org/schema/spring">
    <route id="inventory-check">
      <from uri="kafka:eip.orders.placed?brokers={{kafka.brokers}}&amp;groupId=inventory"/>
      <unmarshal><json/></unmarshal>
      <bean ref="orderValidator" method="validate"/>
      <choice>
        <when>
          <simple>${header.valid} == true</simple>
          <to uri="kafka:eip.inventory.reserved?brokers={{kafka.brokers}}"/>
        </when>
        <otherwise>
          <to uri="kafka:eip.orders.invalid?brokers={{kafka.brokers}}"/>
        </otherwise>
      </choice>
    </route>
  </camelContext>

  <bean id="orderValidator" class="com.example.OrderValidator"/>
</beans>
```

### What Spring XML DSL offers

**XSD validation** — The `camel-spring.xsd` schema validates route structure at edit time. IDEs with XML support (IntelliJ, Eclipse) highlight invalid elements, missing attributes, and structural errors before you run anything.

**Visual tooling** — Route editors like Kaoto and the legacy Fuse Tooling generate and consume Spring XML. If your organization uses visual modeling tools, Spring XML is their interchange format.

**Bean wiring in the same file** — Spring XML co-locates route definitions and bean definitions. The `<bean>` element defines a processor; `<bean ref="..."/>` in the route references it. Everything in one place, no scanning or annotation discovery.

**Runtime route loading** — Spring Boot can load XML routes from the classpath or filesystem at runtime. Change the XML, restart, and routes update without recompilation.

### Why this tutorial doesn't use it

Spring XML carries baggage that makes it a poor fit for a modern tutorial:

**Verbosity.** The same route is 2-3x longer in XML than Java DSL. `&amp;` escaping for URI parameters is a constant source of errors. Every element needs a closing tag. Nesting gets deep fast.

**No inline logic.** In Java DSL, you write `process(exchange -> { ... })` and inline the logic. In Spring XML, every processor must be a separate `<bean>` class, wired by reference. Simple operations balloon into multi-file gymnastics.

**Compilation still required.** Your beans — the processors, validators, aggregation strategies — are Java. You still compile them. The XML just adds a separate route definition layer on top, without removing the Java compilation step.

**Falling community adoption.** The Camel community has moved firmly toward Java DSL (for applications) and YAML DSL (for JBang/GitOps). Spring XML DSL receives maintenance but little new investment. New Camel features occasionally ship without XML DSL support.

### When Spring XML DSL still makes sense

- **Legacy migration.** Migrating from Camel 2.x / Spring Boot 2.x where all routes are already XML. Convert incrementally — Camel Spring Boot loads both XML routes and Java DSL routes simultaneously.
- **Visual modeling.** If the team uses Kaoto or another visual designer, XML is the import/export format.
- **Non-developer route management.** When operations teams manage route topology (endpoints, routing decisions) but developers write the processing logic in Java.

## Testing

### Spring Boot

```java
@SpringBootTest
@CamelSpringBootTest
public class OrderRouteTest {

    @Autowired
    private ProducerTemplate producer;

    @Autowired
    private CamelContext camelContext;

    @EndpointInject("mock:result")
    private MockEndpoint mockResult;

    @Test
    void testOrderRouting() throws Exception {
        // AdviceWith to intercept and mock endpoints
        AdviceWith.adviceWith(camelContext, "inventory-check", a -> {
            a.weaveAddLast().to("mock:result");
        });

        mockResult.expectedMessageCount(1);

        producer.sendBody("direct:test-order",
            Map.of("order_id", 42, "amount", 149.99));

        mockResult.assertIsSatisfied();
    }
}
```

Spring Boot testing uses `@CamelSpringBootTest` (from `camel-test-spring-junit5`) which integrates the Camel test framework with Spring's test context. `@EndpointInject` autowires mock endpoints directly.

### Quarkus

```java
@QuarkusTest
public class OrderRouteTest {

    @Inject
    ProducerTemplate producer;

    @Inject
    CamelContext camelContext;

    @Test
    void testOrderRouting() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:result", MockEndpoint.class);
        mock.expectedMessageCount(1);

        AdviceWith.adviceWith(camelContext, "inventory-check", a -> {
            a.weaveAddLast().to("mock:result");
        });

        producer.sendBody("direct:test-order",
            Map.of("order_id", 42, "amount", 149.99));

        mock.assertIsSatisfied();
    }
}
```

Quarkus uses `@QuarkusTest` (from `quarkus-junit5`) with CDI injection. No special Camel test annotation is needed — the Camel Quarkus extension hooks into the Quarkus test framework automatically. `MockEndpoint` is retrieved from the `CamelContext` directly rather than injected via `@EndpointInject`.

### Dev Services — Quarkus's testing advantage

Quarkus Dev Services automatically starts test containers for infrastructure dependencies:

```properties
# No configuration needed — Quarkus starts containers automatically
%test.quarkus.datasource.devservices.enabled=true
# Kafka: Quarkus starts a Redpanda container
# PostgreSQL: Quarkus starts a PostgreSQL container
# Redis: Quarkus starts a Redis container
```

Spring Boot achieves this with Testcontainers + `@DynamicPropertySource`, which requires more boilerplate:

```java
@SpringBootTest
@Testcontainers
public class OrderRouteIntegrationTest {

    @Container
    static KafkaContainer kafka = new KafkaContainer(
        DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

    @DynamicPropertySource
    static void kafkaProperties(DynamicPropertyRegistry registry) {
        registry.add("kafka.brokers", kafka::getBootstrapServers);
    }
}
```

## Deployment

### Spring Boot

```bash
# Build a fat JAR
mvn package
java -jar target/order-service-1.0.0.jar

# Build a container image (Spring Boot Buildpacks)
mvn spring-boot:build-image

# Native (experimental — Spring AOT)
mvn -Pnative native:compile
```

Spring Boot produces a fat JAR (~50-100MB) by default. Native compilation via Spring AOT + GraalVM is available but less mature than Quarkus — some Camel components have incomplete reflection metadata for native builds.

### Quarkus

```bash
# Build a fast JAR
mvn package
java -jar target/quarkus-app/quarkus-run.jar

# Build a container image
mvn package -Dquarkus.container-image.build=true

# Native
mvn package -Dnative
```

Quarkus native builds are production-ready for Camel. The Camel Quarkus project explicitly tests every extension for native compatibility and maintains GraalVM configuration for each component.

### Production characteristics

| Metric | Spring Boot (JVM) | Spring Boot (Native) | Quarkus (JVM) | Quarkus (Native) |
|--------|-------------------|---------------------|---------------|------------------|
| **Startup** | 3-8s | 200-500ms | 1-3s | 15-50ms |
| **RSS memory** | 200-400MB | 80-150MB | 100-200MB | 30-60MB |
| **Throughput** | Baseline | ~Same | ~Same | ~Same |
| **First request** | After startup | After startup | After startup | After startup |
| **Ecosystem** | Massive | Limited libs | Growing | Most CQ extensions |

For Kubernetes workloads where pod scaling speed matters (scale-to-zero, serverless, burst scaling), Quarkus native provides a 10-100x improvement in startup time. For long-running services where startup is a one-time cost, both runtimes perform comparably at steady state.

## Dependency differences

The same Camel component has different Maven coordinates on each runtime:

| Component | Spring Boot | Quarkus |
|-----------|------------|---------|
| Core | `camel-spring-boot-starter` | `camel-quarkus-core` |
| Kafka | `camel-kafka-starter` | `camel-quarkus-kafka` |
| HTTP | `camel-http-starter` | `camel-quarkus-http` |
| JSON (Jackson) | `camel-jackson-starter` | `camel-quarkus-jackson` |
| REST | `camel-rest-starter` + `camel-servlet-starter` | `camel-quarkus-rest` + `camel-quarkus-platform-http` |
| SQL | `camel-sql-starter` | `camel-quarkus-sql` |
| Testing | `camel-test-spring-junit5` | `camel-quarkus-junit5` |

The naming pattern: Spring Boot uses `-starter` suffix; Quarkus uses `camel-quarkus-` prefix. The underlying Camel component code is identical — only the runtime integration layer differs.

## Migration path: Spring Boot → Quarkus

If you're moving an existing Camel Spring Boot application to Quarkus:

1. **Routes stay the same.** Change `@Component` to `@ApplicationScoped` and `@Autowired` to `@Inject`. The `RouteBuilder.configure()` body is unchanged.

2. **Replace starters with extensions.** Swap `camel-kafka-starter` for `camel-quarkus-kafka`, etc.

3. **Move configuration.** Spring `application.yml` → Quarkus `application.properties`. Property keys for Camel components are identical (`camel.component.kafka.brokers`). Framework-specific keys differ (`spring.datasource.url` → `quarkus.datasource.jdbc.url`).

4. **Update tests.** `@SpringBootTest` → `@QuarkusTest`. `@Autowired` → `@Inject`. Remove `@CamelSpringBootTest` — not needed. `@EndpointInject` → `camelContext.getEndpoint()`.

5. **Drop Spring XML routes.** If you have Spring XML route definitions, convert them to Java DSL. Quarkus does not support Spring XML `<camelContext>`.

6. **Native build.** Quarkus handles GraalVM configuration automatically for all supported Camel Quarkus extensions. Check the [Camel Quarkus extensions reference](https://camel.apache.org/camel-quarkus/latest/reference/index.html) for native support status.

## Why this tutorial chose Quarkus

- **Dev Services** — infrastructure starts automatically in dev and test modes.
- **Native builds** — production-ready for all Camel components used here.
- **Startup time** — fast restarts in dev mode, fast scaling in production.
- **CDI simplicity** — fewer annotations, less framework magic.
- **JBang integration** — `camel run --dev` for prototyping, `camel export --runtime=quarkus` for promotion.
- **Camel-first** — the Camel Quarkus project is an official Apache Camel subproject, ensuring tight integration.

Spring Boot is a perfectly valid choice for Camel. If your organization standardizes on Spring, Camel Spring Boot is mature and well-supported. The patterns in this tutorial — every `RouteBuilder`, every EIP call, every Kafka/Pulsar/Redis integration — work identically on both runtimes. Only the surrounding framework glue changes.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `@Component` is the correct Spring annotation for route discovery in Camel Spring Boot; `camel-spring-boot-starter` is the correct core starter artifact; `@CamelSpringBootTest` exists in `camel-test-spring-junit5`; `@EndpointInject` works for MockEndpoint injection in Spring; `camel.component.kafka.brokers` is the correct property key on both runtimes; Spring Boot Buildpacks command is `spring-boot:build-image`; Quarkus container image build flag is `quarkus.container-image.build=true`; Spring AOT native compilation uses `mvn -Pnative native:compile`.*
