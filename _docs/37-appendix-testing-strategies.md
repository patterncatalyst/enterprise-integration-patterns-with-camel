---
title: "Appendix S: Testing Strategies for Camel Quarkus"
order: 37
part: appendices
description: "Three-tier testing — unit tests with MockEndpoint and AdviceWith, integration tests with Dev Services and REST Assured, and black-box API tests with Newman."
duration: "45 minutes"
---

Chapter 18 introduced the Test Message pattern — runtime health checks that verify a live system. This appendix covers the other side of testing: automated developer-time tests that verify route logic, integration wiring, and API contracts before code reaches production.

Integration-heavy Camel applications need a different testing strategy than typical web apps. Routes wire together Kafka, databases, HTTP services, and CDI beans — testing all of that end-to-end for every change is slow and fragile. The solution is a three-tier pyramid: fast unit tests at the base, integration tests in the middle, and external API tests at the top.

The code is in `examples/37-testing-strategies/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/37-testing-strategies/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/37-testing-strategies/spring-boot
mvn spring-boot:run
```

{% include excalidraw.html file="37-appendix-testing-strategies" alt="Testing pyramid with three tiers — unit tests at the base, integration tests in the middle, Newman at the top" caption="Figure S.1 — The testing pyramid for Camel Quarkus: unit tests are fast and many, integration tests verify real infrastructure, Newman tests validate external API contracts." %}

## The testing toolbox

### quarkus-junit vs camel-quarkus-junit5

| Artifact | Provides | When to use |
|----------|----------|-------------|
| `quarkus-junit` | `@QuarkusTest`, `@QuarkusIntegrationTest`, `@TestProfile`, `@InjectMock`, REST Assured auto-config | Every Quarkus test |
| `camel-quarkus-junit5` | `CamelQuarkusTestSupport` base class, `getMockEndpoint()`, `template` field, automatic advice cleanup | Teams migrating from `CamelTestSupport` |
| `camel-quarkus-mock` | `mock:` endpoint component resolution at Quarkus build time | Any test that uses `MockEndpoint` |

The `camel-quarkus-mock` dependency is easy to forget. Without it, Quarkus cannot resolve `mock:` URIs at build time and the test fails with a component-not-found error:

```xml
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-mock</artifactId>
    <scope>test</scope>
</dependency>
```

### Key classes

| Class | Purpose |
|-------|---------|
| `MockEndpoint` | Captures messages and asserts expectations (count, body, headers) |
| `ProducerTemplate` | Sends messages into routes from test code |
| `AdviceWith` | Rewires routes at test time — replace endpoints, intercept sends, skip processors |
| `CamelContext` | Access to routes, endpoints, and the mock registry |

### The shared CamelContext constraint

Quarkus boots one `CamelContext` per test run — it is not stopped and restarted between test classes (unlike Spring Boot's `@DirtiesContext`). This means:

- **AdviceWith modifications accumulate.** If test A adds `mock:result` to a route and test B adds `mock:result` again, the route now has two mock endpoints. Apply advice once (in `@BeforeAll` with `@TestInstance(PER_CLASS)`) and reset mocks before each test.
- **Use `@TestProfile` to force a context restart** when you need a clean slate for integration tests.
- **Call `MockEndpoint.resetMocks(camelContext)`** in `@BeforeEach` to clear received exchanges and expectations between tests.

## Tier 1 — Unit testing routes

Unit tests verify route logic (content-based routing, filtering, enrichment) without any infrastructure. The approach: use `AdviceWith` to replace Kafka consumers with `direct:` endpoints and intercept Kafka producers with `mock:` endpoints, then send test messages via `ProducerTemplate` and assert against mock expectations.

### Style A — CDI injection with @QuarkusTest

The Quarkus-native approach: inject `CamelContext` and `ProducerTemplate` via CDI, manage mocks manually.

Given a content-based router that routes orders to domestic, international, or hazmat handling:

```java
from("direct:validate-order")
    .routeId("order-validation")
    .unmarshal().json(java.util.Map.class)
    .choice()
        .when().simple("${body[shipping_type]} == 'HAZMAT'")
            .to("direct:hazmat")
        .when().simple("${body[country]} != 'US'")
            .to("direct:international")
        .otherwise()
            .to("direct:domestic")
    .end();
```

The test:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
@QuarkusTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderValidationRouteTest {

    @Inject CamelContext camelContext;
    @Inject ProducerTemplate producer;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "domestic-handler", route -> {
            route.weaveAddLast().to("mock:domestic");
        });
        AdviceWith.adviceWith(camelContext, "international-handler", route -> {
            route.weaveAddLast().to("mock:international");
        });
        AdviceWith.adviceWith(camelContext, "hazmat-handler", route -> {
            route.weaveAddLast().to("mock:hazmat");
        });
    }

    @BeforeEach
    void resetMocks() {
        MockEndpoint.resetMocks(camelContext);
    }

    @Test
    void domesticOrderRoutesToDomestic() throws Exception {
        MockEndpoint domestic = camelContext.getEndpoint(
            "mock:domestic", MockEndpoint.class);
        domestic.expectedMessageCount(1);

        producer.sendBody("direct:validate-order",
            "{\"order_id\": 1001, \"country\": \"US\", " +
            "\"shipping_type\": \"STANDARD\", \"amount\": 59.99}");

        domestic.assertIsSatisfied();
    }
}
```

```java
@SpringBootTest
@CamelSpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderValidationRouteTest {

    @Autowired CamelContext camelContext;
    @Autowired ProducerTemplate producer;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "domestic-handler", route -> {
            route.weaveAddLast().to("mock:domestic");
        });
        AdviceWith.adviceWith(camelContext, "international-handler", route -> {
            route.weaveAddLast().to("mock:international");
        });
        AdviceWith.adviceWith(camelContext, "hazmat-handler", route -> {
            route.weaveAddLast().to("mock:hazmat");
        });
    }

    @BeforeEach
    void resetMocks() {
        MockEndpoint.resetMocks(camelContext);
    }

    @Test
    void domesticOrderRoutesToDomestic() throws Exception {
        MockEndpoint domestic = camelContext.getEndpoint(
            "mock:domestic", MockEndpoint.class);
        domestic.expectedMessageCount(1);

        producer.sendBody("direct:validate-order",
            "{\"order_id\": 1001, \"country\": \"US\", " +
            "\"shipping_type\": \"STANDARD\", \"amount\": 59.99}");

        domestic.assertIsSatisfied();
    }
}
```

Key points:
- `@TestInstance(PER_CLASS)` enables `@BeforeAll` on instance methods (needed for CDI injection).
- `AdviceWith` runs once in `@BeforeAll` to avoid accumulating duplicate advice.
- `MockEndpoint.resetMocks()` clears state between tests.

### Style B — CamelQuarkusTestSupport

For teams migrating from Camel's standalone `CamelTestSupport`, `CamelQuarkusTestSupport` provides familiar helpers: `template`, `context`, and `getMockEndpoint()`:

```java
@QuarkusTest
class OrderFilterRouteTest extends CamelQuarkusTestSupport {

    private boolean advised = false;

    @Override
    protected void doBeforeEach(QuarkusTestMethodContext ctx)
            throws Exception {
        super.doBeforeEach(ctx);
        if (!advised) {
            AdviceWith.adviceWith(context, "kafka-order-filter", route -> {
                route.replaceFromWith("direct:test-kafka-input");
            });
            AdviceWith.adviceWith(context, "high-value-handler", route -> {
                route.weaveAddLast().to("mock:high-value");
            });
            advised = true;
        }
    }

    @Test
    void highValueOrderPassesFilter() throws Exception {
        MockEndpoint mock = getMockEndpoint("mock:high-value");
        mock.reset();
        mock.expectedMessageCount(1);

        template.sendBody("direct:filter-order",
            "{\"order_id\": 2001, \"amount\": 250.00}");

        mock.assertIsSatisfied();
    }
}
```

`CamelQuarkusTestSupport` implements `QuarkusTestProfile`, so extending it forces a CamelContext restart for that test class — which can be an advantage (clean isolation) or a cost (slower startup). Use it when you want the familiar Camel testing API; use Style A when you prefer Quarkus-native patterns.

### AdviceWith patterns

| Pattern | Method | Use case |
|---------|--------|----------|
| Replace consumer | `replaceFromWith("direct:test")` | Swap Kafka/timer consumer for a testable `direct:` |
| Intercept producer | `weaveByToUri("kafka:*").replace().to("mock:output")` | Capture messages headed for Kafka |
| Append mock | `weaveAddLast().to("mock:result")` | Observe what a route produces without changing its logic |
| Skip processor | `weaveById("processorId").replace().to("mock:skip")` | Bypass a specific processor (HTTP call, database write) |
| Blanket mock | `mockEndpointsAndSkip("kafka:*")` | Mock all Kafka endpoints at once |

**Warning about blanket mocking**: `mockEndpointsAndSkip("kafka:*")` replaces *every* Kafka endpoint in the route, including consumers. Prefer specific URIs or route IDs when you only want to mock the producer side.

### Mocking CDI beans with @InjectMock

When a route calls `.bean("inventoryService", "checkStock")`, mock the CDI bean instead of the Camel endpoint:

```java
@QuarkusTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderEnrichmentRouteTest {

    @Inject CamelContext camelContext;
    @Inject ProducerTemplate producer;
    @InjectMock InventoryService inventoryService;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "enriched-output-handler",
            route -> route.weaveAddLast().to("mock:enriched"));
    }

    @BeforeEach
    void setup() {
        MockEndpoint.resetMocks(camelContext);
        when(inventoryService.checkStock(any())).thenReturn(Map.of(
            "order_id", 3001,
            "warehouse", "WAREHOUSE-MOCK",
            "stock_available", 99
        ));
    }

    @Test
    void orderIsEnrichedWithInventoryData() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint(
            "mock:enriched", MockEndpoint.class);
        mock.expectedMessageCount(1);

        producer.sendBody("direct:enrich-order",
            "{\"order_id\": 3001, \"item_sku\": \"ELEC-TV-55\"}");

        mock.assertIsSatisfied();
        String body = mock.getReceivedExchanges().get(0)
            .getIn().getBody(String.class);
        assertTrue(body.contains("WAREHOUSE-MOCK"));
    }
}
```

`@InjectMock` replaces the real CDI bean with a Mockito mock for the duration of the test class. The route code doesn't change — it still calls `.bean("inventoryService", "checkStock")`, but the mock intercepts the call.

The `quarkus-junit-mockito` dependency provides `@InjectMock`:

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-junit-mockito</artifactId>
    <scope>test</scope>
</dependency>
```

## Tier 2 — Integration testing

Integration tests verify that routes work with real infrastructure — HTTP endpoints, Kafka brokers, databases. They are slower (container startup) but catch problems that unit tests cannot: serialization issues, configuration errors, and infrastructure-specific behavior.

### REST Assured with Camel REST DSL

REST Assured is Quarkus's built-in HTTP testing library. It speaks fluent Java and integrates with `@QuarkusTest` to auto-detect the test port:

```java
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
class PaymentGatewayIT {

    @Test
    void validPaymentReturnsApproval() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"order_id\": 5001, \"amount\": 99.99}")
        .when()
            .post("/api/payments/process")
        .then()
            .statusCode(200)
            .body("status", equalTo("APPROVED"))
            .body("gateway", equalTo("MOCK"))
            .body("transaction_id", notNullValue());
    }
}
```

No Camel-specific API — pure HTTP request/response assertions. This tests the full stack from HTTP request through the REST DSL, Camel route, and response marshalling.

### @TestProfile for configuration isolation

A `QuarkusTestProfile` overrides configuration for a specific set of tests:

```java
public class IntegrationTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
            "payment.gateway.mode", "mock",
            "quarkus.kafka.devservices.enabled", "false",
            "quarkus.http.test-port", "0"
        );
    }

    @Override
    public String getConfigProfile() {
        return "integration-test";
    }
}
```

Applying `@TestProfile` forces Quarkus to restart the CamelContext with the profile's configuration — providing clean isolation from unit tests that may have modified routes with AdviceWith.

### Dev Services for real Kafka

When `quarkus-kafka` is on the classpath and Dev Services is enabled, Quarkus auto-starts a Redpanda container for tests. The Kafka broker address is injected automatically — no manual configuration:

```properties
# application.properties — for integration tests
%integration-test.quarkus.kafka.devservices.enabled=true
```

Tests can then send and consume real Kafka messages:

```java
@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
class KafkaIntegrationTest {

    @Inject CamelContext camelContext;
    @Inject ProducerTemplate producer;

    @Test
    void orderFlowsThroughKafkaFilter() throws Exception {
        AdviceWith.adviceWith(camelContext, "kafka-order-filter",
            route -> route.replaceFromWith("direct:kafka-test-input"));
        AdviceWith.adviceWith(camelContext, "high-value-handler",
            route -> route.weaveAddLast().to("mock:kafka-high-value"));

        MockEndpoint mock = camelContext.getEndpoint(
            "mock:kafka-high-value", MockEndpoint.class);
        mock.reset();
        mock.expectedMessageCount(1);

        producer.sendBody("direct:filter-order",
            "{\"order_id\": 6001, \"amount\": 500.00}");

        mock.assertIsSatisfied();
    }
}
```

### @QuarkusIntegrationTest for packaged artifact testing

`@QuarkusIntegrationTest` tests the packaged JAR/native binary as a black box. Create a class that extends your `@QuarkusTest` integration test — it inherits all REST Assured assertions but runs them against the built artifact:

```java
@QuarkusIntegrationTest
class PaymentGatewayNativeIT extends PaymentGatewayIT {
}
```

This one-liner class runs the same `validPaymentReturnsApproval()` test against the packaged JAR. No `@Inject` is available — only HTTP-level assertions via REST Assured.

Maven Failsafe runs `*IT.java` classes in the `integration-test` phase:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <version>3.5.2</version>
    <executions>
        <execution>
            <goals>
                <goal>integration-test</goal>
                <goal>verify</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

## Tier 3 — Newman / Postman

Newman is Postman's CLI runner — it executes Postman collection JSON files from the command line. It fills a specific niche: **external black-box API testing** with a shareable, non-Java test artifact.

### Where Newman fits

| | REST Assured (Tier 2) | Newman (Tier 3) |
|---|---|---|
| Language | Java | JavaScript (Postman test scripts) |
| Runs in-process | Yes (`@QuarkusTest`) | No (external process) |
| `@Inject` access | Yes | No |
| Shareable with QA | Limited | Yes (Postman GUI or CLI) |
| IDE integration | Full (JUnit) | Limited |
| CI integration | Native (Surefire/Failsafe) | JUnit XML export |

Use Newman when:
- QA needs to run the same tests in Postman's GUI
- You want a language-neutral API contract test
- The test validates an already-running deployment (staging, production)

Use REST Assured when:
- You need CDI injection or CamelContext access
- Tests should run as part of `mvn verify` with no external dependencies
- You want full IDE debugging support

### Collection structure

A Postman collection has requests grouped into folders, each with test scripts:

```
eip-testing-collection.json
├── Health Checks/
│   ├── Liveness probe — GET /q/health/live
│   └── Readiness probe — GET /q/health/ready
└── Payment Gateway/
    ├── Process valid payment — POST /api/payments/process
    ├── Process empty body — POST /api/payments/process
    └── Process large payment — POST /api/payments/process
```

Each request includes test scripts that run after the response:

```javascript
pm.test('Payment returns 200', function () {
    pm.response.to.have.status(200);
});
pm.test('Status is APPROVED', function () {
    var json = pm.response.json();
    pm.expect(json.status).to.eql('APPROVED');
});
pm.test('Response time under 2s', function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

### Running Newman

Manually:

```bash
npm install -g newman

newman run src/test/resources/postman/eip-testing-collection.json \
  -e src/test/resources/postman/local-env.json
```

The environment file sets `baseUrl`:

```json
{
  "values": [
    {"key": "baseUrl", "value": "http://localhost:8082", "enabled": true}
  ]
}
```

### Maven integration

Use a Maven profile so Newman doesn't run unless explicitly requested (it requires Node.js and the app running):

```xml
<profile>
    <id>newman</id>
    <build>
        <plugins>
            <plugin>
                <groupId>org.codehaus.mojo</groupId>
                <artifactId>exec-maven-plugin</artifactId>
                <version>3.5.0</version>
                <executions>
                    <execution>
                        <id>newman-run</id>
                        <phase>integration-test</phase>
                        <goals><goal>exec</goal></goals>
                        <configuration>
                            <executable>newman</executable>
                            <arguments>
                                <argument>run</argument>
                                <argument>src/test/resources/postman/eip-testing-collection.json</argument>
                                <argument>-e</argument>
                                <argument>src/test/resources/postman/local-env.json</argument>
                                <argument>--reporters</argument>
                                <argument>cli,junit</argument>
                                <argument>--reporter-junit-export</argument>
                                <argument>target/newman-results.xml</argument>
                            </arguments>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</profile>
```

The `--reporter-junit-export` flag produces JUnit XML that CI systems (GitHub Actions, Jenkins) can pick up for unified test reporting.

## Putting it all together

### Maven lifecycle

| Command | Tiers | Infrastructure | Time |
|---------|-------|---------------|------|
| `mvn test` | Tier 1 only | None | ~10s |
| `mvn verify` | Tier 1 + Tier 2 | Failsafe starts packaged app | ~30-60s |
| `mvn verify -Pnewman` | All three | Above + Newman (app must be running) | ~90s |

### Continuous testing

Appendix C showed how `mvn quarkus:dev` runs tests continuously as you code. Press `r` to toggle continuous testing — only Tier 1 and Tier 2 `@QuarkusTest` tests participate. Newman tests (Tier 3) are external and must be run separately.

### Test-scoped dependencies summary

```xml
<!-- Tier 1: Unit -->
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-junit</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-junit5</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.apache.camel.quarkus</groupId>
    <artifactId>camel-quarkus-mock</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-junit-mockito</artifactId>
    <scope>test</scope>
</dependency>

<!-- Tier 2: Integration -->
<dependency>
    <groupId>io.rest-assured</groupId>
    <artifactId>rest-assured</artifactId>
    <scope>test</scope>
</dependency>
```

## Common pitfalls

**Shared CamelContext contamination.** AdviceWith modifications from one test class carry over to the next because the CamelContext isn't restarted. Apply advice once in `@BeforeAll` (not `@BeforeEach`) and reset mocks before each test. If two test classes need conflicting advice, put them in different `@TestProfile` groups to force a context restart.

**Timer and Kafka routes firing during tests.** Routes with `from("timer:...")` or `from("kafka:...")` start automatically when the CamelContext boots. Use AdviceWith to replace them with `direct:` endpoints, or exclude them via application properties:

```properties
%test.quarkus.camel.routes-discovery.exclude-patterns=**/DemoDataGenerator*
```

**Port conflicts with the Podman stack.** If your local Podman stack is running Kafka on port 9092 and Dev Services tries to start another Kafka, you get port conflicts. Disable Dev Services when using the local stack:

```properties
%test.quarkus.kafka.devservices.enabled=false
```

**Newman assumes the app is running.** Unlike REST Assured (which starts the app via `@QuarkusTest`), Newman is an external process. Start the app with `mvn quarkus:dev` (Quarkus) or `mvn spring-boot:run` (Spring Boot) in one terminal before running Newman in another. For CI, use Quarkus's Failsafe integration to start/stop the app around the `integration-test` phase.

**CamelQuarkusTestSupport is JVM-only.** It cannot be used with `@QuarkusIntegrationTest` (which tests the packaged artifact without CDI). For native image testing, use REST Assured assertions only.

**Artifact rename in Quarkus 3.31+.** `quarkus-junit5` was renamed to `quarkus-junit` and `quarkus-junit5-mockito` to `quarkus-junit-mockito`. The old names still work (Maven redirects them) but produce deprecation warnings. Use the new names.

## References

- [Apache Camel — Testing](https://camel.apache.org/manual/testing.html)
- [Apache Camel Quarkus — Testing](https://camel.apache.org/camel-quarkus/latest/user-guide/testing.html)
- [Quarkus — Testing Guide](https://quarkus.io/guides/getting-started-testing)
- [Newman CLI Documentation](https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/)
- Chapter 18 — Testing & System Management (Test Message pattern)
- Appendix A — DSL Comparison (Spring Boot vs Quarkus testing)
- Appendix C — Quarkus Dev Mode (continuous testing)

## What you learned

- **Tier 1 (unit tests)** verifies route logic with `MockEndpoint` and `AdviceWith` — no infrastructure needed, runs in seconds.
- **Tier 2 (integration tests)** uses REST Assured and Dev Services to test HTTP endpoints and real Kafka — catches serialization and configuration issues.
- **Tier 3 (Newman)** provides external black-box API tests with shareable Postman collections — complements in-process tests for CI and QA workflows.
- **AdviceWith** is the key to testable Camel routes: replace Kafka consumers with `direct:` endpoints, intercept producers with `mock:` endpoints, and mock CDI beans with `@InjectMock`.
- **The shared CamelContext** is the biggest gotcha — apply advice once, reset mocks before each test, and use `@TestProfile` for isolation.

---

*Verification status: <span class="status status--verified">verified</span> against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
