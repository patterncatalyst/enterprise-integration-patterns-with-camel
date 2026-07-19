---
title: "Appendix W: Citrus Integration Testing"
order: 41
part: appendices
description: "End-to-end integration testing with Citrus — testing Camel routes against real Kafka, HTTP, and database infrastructure using the Camel test plugin."
duration: "35 minutes"
---

Appendix S covered the Camel-native testing toolkit: MockEndpoint for unit testing route logic, AdviceWith for intercepting and rewiring endpoints, REST Assured for HTTP assertions, and Newman for external API contract testing. Those tools verify route behavior in isolation — they replace Kafka brokers with `direct:` and `mock:` endpoints, swap databases for in-memory substitutes, and short-circuit HTTP calls with stubs. The tests run fast, but they cannot catch the bugs that only surface when your route talks to the real thing: serialization mismatches, topic configuration errors, consumer group rebalancing quirks, or HTTP content negotiation failures.

Citrus takes a different approach. It tests integrations **end-to-end against real infrastructure**. A Citrus test spins up a Kafka broker via Testcontainers, launches your Camel route, sends messages to input topics, and verifies that the expected messages appear on output topics. No mocks, no stubs — the same components your route uses in production. When the test passes, you know the route works with real Kafka, real HTTP endpoints, and real serialization.

Citrus integrates with the Camel CLI via the `camel test` plugin command, making it natural to test YAML DSL routes without a Maven project. Write a route in YAML, write a test in YAML, run `camel test run`, and Citrus handles the rest — starting infrastructure, deploying the route, executing test scenarios, and reporting results. When you are ready for CI/CD, `camel export` generates a Maven project with JUnit 5 test classes and Citrus dependencies included.

The code is in `examples/41-citrus-testing/`.

```bash
camel test run test/order-validation-test.yaml
```

{% include excalidraw.html file="41-citrus-testing" alt="Citrus test execution flow" caption="Figure W.1 — Citrus test lifecycle: start infrastructure via Testcontainers, launch the Camel route, send test messages, and verify results on output topics." %}

## Setup

Citrus tests require the Camel CLI test plugin. If you followed the CLI installation in Appendix U, you already have the `camel` command — add the test plugin:

```bash
camel plugin add test
```

This makes `camel test init`, `camel test run`, and related sub-commands available. Verify the plugin is installed:

```bash
camel plugin get
```

You should see `test` in the list of installed plugins.

### Dependencies

Test dependencies are declared in `jbang.properties` alongside your route files. The Citrus framework is modular — you add only the connectors you need:

```properties
# Citrus testing dependencies
camel.jbang.dependencies=org.citrusframework:citrus-camel:4.4.0,org.citrusframework:citrus-kafka:4.4.0,org.citrusframework:citrus-http:4.4.0
```

| Artifact | Purpose |
|----------|---------|
| `citrus-camel` | Core Citrus-Camel integration — test lifecycle, route deployment, endpoint binding |
| `citrus-kafka` | Kafka producer/consumer test actions — send to topics, receive from topics, assert message content |
| `citrus-http` | HTTP client/server test actions — send requests, assert responses, mock HTTP services |

Additional connectors are available for databases (`citrus-sql`), JMS (`citrus-jms`), mail (`citrus-mail`), and other transports. Add them to `jbang.properties` as your tests require them.

### Infrastructure prerequisites

Citrus uses Testcontainers to manage infrastructure. You need either Docker or Podman running on your machine. The first test run pulls container images (Kafka, etc.) — subsequent runs reuse cached images.

If you are using Podman, ensure the Podman socket is enabled so Testcontainers can communicate with it:

```bash
systemctl --user enable --now podman.socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock
export TESTCONTAINERS_RYUK_DISABLED=true
```

## Test structure

A Citrus test follows a four-step pattern that mirrors the Arrange-Act-Assert structure familiar from unit testing:

1. **Start infrastructure** — Citrus spins up Kafka (or Postgres, Redis, etc.) via Testcontainers. The containers are ephemeral — created fresh for each test run and destroyed afterward.

2. **Launch the integration** — Citrus deploys the Camel route under test into a lightweight Camel context. The route connects to the Testcontainers-managed infrastructure using overridden connection properties.

3. **Send test messages** — the test produces messages to inputs: Kafka topics, REST endpoints, file directories, or any Camel-supported source.

4. **Verify outcomes** — the test consumes from output topics or endpoints and asserts that the expected messages arrived with the correct body, headers, and structure.

Steps 1 and 2 are handled automatically by the Citrus test runtime. You write steps 3 and 4 as `actions` in the test YAML file:

```yaml
name: OrderValidationTest
description: "Verify order validation route correctly routes valid and invalid orders"
actions:
  # Step 3: Send a test message (Act)
  - send:
      endpoint: "kafka:eip.orders.incoming"
      message:
        body: |
          {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}

  # Step 4: Verify the outcome (Assert)
  - receive:
      endpoint: "kafka:eip.orders.validated"
      timeout: 10000
      message:
        body: |
          {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}
```

The `send` action publishes a message to the specified endpoint. The `receive` action waits (up to `timeout` milliseconds) for a message on the specified endpoint and asserts that its body matches the expected content. If the expected message does not arrive within the timeout, the test fails.

## Writing tests in YAML

### Generating a test skeleton

The `camel test init` command generates a skeleton test file for an existing route:

```bash
camel test init order-validation-route.yaml
```

This creates a test file under `test/` with the route's input and output endpoints pre-populated. You fill in the test data and assertions.

### YAML test anatomy

A test file has three top-level fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Test name — used in reports and logs |
| `description` | No | Human-readable description of what the test verifies |
| `actions` | Yes | Ordered list of test steps — executed sequentially |

### Action types

Citrus supports several action types for different testing scenarios:

**`send`** — publish a message to an endpoint:

```yaml
- send:
    endpoint: "kafka:eip.orders.incoming"
    message:
      headers:
        Content-Type: application/json
        orderId: ORD-001
      body: |
        {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}
```

**`receive`** — consume a message from an endpoint and assert its content:

```yaml
- receive:
    endpoint: "kafka:eip.orders.validated"
    timeout: 10000
    message:
      body: |
        {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}
```

**`http`** — send an HTTP request and assert the response:

```yaml
- http:
    client: "orderApi"
    send:
      method: POST
      url: "http://localhost:8088/api/orders"
      message:
        headers:
          Content-Type: application/json
        body: |
          {"orderId":"ORD-010","customerId":"C-110","item":"Cargo Net","quantity":5}
- http:
    client: "orderApi"
    receive:
      status: 200
      message:
        body: |
          {"status":"accepted","orderId":"ORD-010"}
```

**`sleep`** — pause between actions (useful for eventual consistency scenarios):

```yaml
- sleep:
    milliseconds: 2000
```

**`echo`** — print a message to the test log (useful for debugging):

```yaml
- echo:
    message: "Sending valid order ORD-001 to incoming topic"
```

### Message matching

By default, Citrus performs an exact match on the message body. For JSON bodies, Citrus compares the JSON structure — field order does not matter. You can also use partial matching with JSON path expressions:

```yaml
- receive:
    endpoint: "kafka:eip.orders.validated"
    timeout: 10000
    message:
      body: |
        {"orderId":"ORD-001","customerId":"@ignore@","item":"@ignore@","quantity":"@isNumber()@"}
```

The `@ignore@` placeholder matches any value. Citrus provides several validation matchers:

| Matcher | Description |
|---------|-------------|
| `@ignore@` | Match any value |
| `@isNumber()@` | Match any numeric value |
| `@isEmpty()@` | Match an empty or null value |
| `@notEmpty()@` | Match a non-empty value |
| `@startsWith('prefix')@` | Match values starting with a prefix |
| `@contains('text')@` | Match values containing a substring |
| `@matches('regex')@` | Match values against a regular expression |

These matchers are valuable when the route enriches messages with dynamic values (timestamps, generated IDs) that you cannot predict in the test.

## Infrastructure management

Citrus uses the Camel CLI's infrastructure management to provision services for tests. The `camel infra` command family manages Testcontainers-backed services that your tests need.

### Listing available services

```bash
camel infra list
```

This shows all services that the CLI can provision — Kafka, PostgreSQL, Redis, ActiveMQ, and others. Each service maps to a Testcontainers image.

### Starting services manually

You can start infrastructure services outside of a test run for debugging:

```bash
camel infra run kafka
```

This starts a Kafka container and prints the connection properties. The container stays running until you stop it with `camel infra stop kafka`.

### Automatic infrastructure in tests

When you run `camel test run`, Citrus inspects the route under test and automatically starts the infrastructure services it needs. If the route consumes from `kafka:`, Citrus starts a Kafka container. If it connects to `sql:`, Citrus starts a PostgreSQL container. You do not need to declare infrastructure services in the test file — Citrus infers them from the route endpoints.

### Service property injection

Testcontainers assign random ports to avoid conflicts with services already running on the host. Citrus injects the actual connection properties as environment variables that your route configuration can reference:

| Variable | Description |
|----------|-------------|
| `CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP` | Kafka bootstrap server address (e.g., `localhost:55123`) |
| `CITRUS_CAMEL_INFRA_POSTGRES_URL` | PostgreSQL JDBC URL |
| `CITRUS_CAMEL_INFRA_REDIS_URL` | Redis connection URL |
| `CITRUS_TESTCONTAINERS_KAFKA_PORT` | Mapped Kafka port number |

Your `application.test.properties` file uses these variables to override the production configuration:

```properties
# Override for test environment — Citrus manages the Kafka broker
camel.component.kafka.brokers=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP}
```

When `camel test run` executes, it loads `application.test.properties` after `application.properties`, so the test overrides take precedence. This pattern keeps your route YAML unchanged — the same route file runs against a local Kafka cluster in development and a Testcontainers-managed broker in tests.

## Testing with Kafka

The core use case for Citrus in a Camel integration project is testing message-driven routes that consume from and produce to Kafka topics. Let us walk through the complete Kafka testing scenario from the example.

### The route under test

The order validation route in `order-validation-route.yaml` consumes from `kafka:eip.orders.incoming`, validates the order payload, and routes to one of two output topics:

- **Valid orders** — enriched with a `validatedAt` header and published to `kafka:eip.orders.validated`
- **Invalid orders** — tagged with a `rejectionReason` header and published to `kafka:eip.orders.rejected`

Validation checks four fields: `orderId` must not be null, `customerId` must not be null, `item` must not be null, and `quantity` must be greater than zero.

### The test

The test file `test/order-validation-test.yaml` verifies both the happy path and several rejection scenarios:

```yaml
name: OrderValidationTest
description: "Verify order validation route correctly routes valid and invalid orders"
actions:
  # --- Scenario 1: valid order ---
  - send:
      endpoint: "kafka:eip.orders.incoming"
      message:
        body: |
          {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}
  - receive:
      endpoint: "kafka:eip.orders.validated"
      timeout: 10000
      message:
        body: |
          {"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}

  # --- Scenario 2: missing customerId ---
  - send:
      endpoint: "kafka:eip.orders.incoming"
      message:
        body: |
          {"orderId":"ORD-002","item":"Pallet Jack","quantity":1}
  - receive:
      endpoint: "kafka:eip.orders.rejected"
      timeout: 10000
      message:
        body: |
          {"orderId":"ORD-002","item":"Pallet Jack","quantity":1}

  # --- Scenario 3: zero quantity ---
  - send:
      endpoint: "kafka:eip.orders.incoming"
      message:
        body: |
          {"orderId":"ORD-003","customerId":"C-102","item":"Cargo Net","quantity":0}
  - receive:
      endpoint: "kafka:eip.orders.rejected"
      timeout: 10000
      message:
        body: |
          {"orderId":"ORD-003","customerId":"C-102","item":"Cargo Net","quantity":0}

  # --- Scenario 4: missing item ---
  - send:
      endpoint: "kafka:eip.orders.incoming"
      message:
        body: |
          {"orderId":"ORD-004","customerId":"C-103","quantity":5}
  - receive:
      endpoint: "kafka:eip.orders.rejected"
      timeout: 10000
      message:
        body: |
          {"orderId":"ORD-004","customerId":"C-103","quantity":5}
```

### Running the test

```bash
cd examples/41-citrus-testing
camel test run test/order-validation-test.yaml
```

Citrus performs the following steps:

1. Detects `kafka:` endpoints in the route and starts a Kafka container via Testcontainers
2. Waits for the Kafka broker to become healthy
3. Creates the required topics (`eip.orders.incoming`, `eip.orders.validated`, `eip.orders.rejected`)
4. Deploys `order-validation-route.yaml` into a Camel context configured with the Testcontainers broker address
5. Executes each action in sequence — sending messages and verifying received messages
6. Reports pass/fail results and tears down the Kafka container

Expected output for a passing test:

```
[citrus:test] Starting infrastructure...
[citrus:test]   Kafka container started on localhost:55123
[citrus:test] Deploying integration: order-validation-route.yaml
[citrus:test] Running test: OrderValidationTest
[citrus:test]   SEND  -> kafka:eip.orders.incoming    (ORD-001)
[citrus:test]   RECV  <- kafka:eip.orders.validated    (ORD-001) OK
[citrus:test]   SEND  -> kafka:eip.orders.incoming    (ORD-002)
[citrus:test]   RECV  <- kafka:eip.orders.rejected     (ORD-002) OK
[citrus:test]   SEND  -> kafka:eip.orders.incoming    (ORD-003)
[citrus:test]   RECV  <- kafka:eip.orders.rejected     (ORD-003) OK
[citrus:test]   SEND  -> kafka:eip.orders.incoming    (ORD-004)
[citrus:test]   RECV  <- kafka:eip.orders.rejected     (ORD-004) OK
[citrus:test] OrderValidationTest: PASSED (4/4 scenarios)
[citrus:test] Stopping infrastructure...
```

### Debugging test failures

When a `receive` action fails, Citrus reports what it expected versus what it received (or that no message arrived within the timeout):

```
[citrus:test]   RECV  <- kafka:eip.orders.validated    FAILED
[citrus:test]     Expected: {"orderId":"ORD-001","customerId":"C-101",...}
[citrus:test]     Received: <no message within 10000ms>
```

Common failure causes:

- **Route not consuming** — check that `application.test.properties` overrides the broker address correctly
- **Topic name mismatch** — the test endpoint URI must match the route's topic exactly
- **Serialization mismatch** — the route may produce a different JSON structure than expected (e.g., additional fields from enrichment)
- **Timeout too short** — increase the `timeout` value if the route involves slow processors

Use `camel trace` alongside the test to see exchanges flowing through the route in real time:

```bash
# In a separate terminal
camel trace order-validation
```

## Testing with HTTP

Citrus also supports testing REST endpoints exposed by Camel routes. The HTTP test actions send requests to the route's REST API and assert the response status and body.

### HTTP test walkthrough

The test file `test/order-http-test.yaml` tests an order validation endpoint:

```yaml
name: OrderHttpValidationTest
description: "Verify order validation via REST endpoint"
actions:
  # --- Scenario 1: valid order via POST ---
  - http:
      client: "orderApi"
      send:
        method: POST
        url: "http://localhost:8088/api/orders"
        message:
          headers:
            Content-Type: application/json
          body: |
            {"orderId":"ORD-010","customerId":"C-110","item":"Cargo Net","quantity":5}
  - http:
      client: "orderApi"
      receive:
        status: 200
        message:
          body: |
            {"status":"accepted","orderId":"ORD-010"}

  # --- Scenario 2: invalid order (missing item) ---
  - http:
      client: "orderApi"
      send:
        method: POST
        url: "http://localhost:8088/api/orders"
        message:
          headers:
            Content-Type: application/json
          body: |
            {"orderId":"ORD-011","customerId":"C-111","quantity":3}
  - http:
      client: "orderApi"
      receive:
        status: 400
        message:
          body: |
            {"status":"rejected","orderId":"ORD-011","reason":"item must not be null"}
```

Running the HTTP test:

```bash
camel test run test/order-http-test.yaml
```

### REST testing vs message-driven testing

HTTP tests and Kafka tests serve different purposes:

| Aspect | Kafka test | HTTP test |
|--------|-----------|-----------|
| Communication | Asynchronous (fire and verify later) | Synchronous (request-response) |
| Infrastructure | Testcontainers Kafka broker | Route's built-in HTTP server |
| Latency tolerance | Must handle consumer lag, rebalancing | Immediate response expected |
| Use case | Message-driven pipelines | REST APIs, webhooks, health endpoints |

For routes that expose both a REST API and Kafka outputs (e.g., accept an order via POST, validate it, and publish to a Kafka topic), combine both test types. Use the HTTP test to verify the synchronous response and the Kafka test to verify the asynchronous downstream output.

## Test variables and property resolution

Citrus provides a property resolution mechanism that bridges Testcontainers' dynamic port allocation with your route configuration.

### Infrastructure variables

When Citrus starts a Testcontainers service, it exposes connection details as environment variables. These variables follow a naming convention:

```
CITRUS_CAMEL_INFRA_{SERVICE}_{PROPERTY}
```

For Kafka:

| Variable | Example value |
|----------|---------------|
| `CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP` | `localhost:55123` |
| `CITRUS_TESTCONTAINERS_KAFKA_PORT` | `55123` |
| `CITRUS_TESTCONTAINERS_KAFKA_HOST` | `localhost` |

For PostgreSQL:

| Variable | Example value |
|----------|---------------|
| `CITRUS_CAMEL_INFRA_POSTGRES_URL` | `jdbc:postgresql://localhost:55432/test` |
| `CITRUS_CAMEL_INFRA_POSTGRES_USERNAME` | `test` |
| `CITRUS_CAMEL_INFRA_POSTGRES_PASSWORD` | `test` |

### The application.test.properties pattern

The recommended approach is to create an `application.test.properties` file that overrides production configuration with Citrus-managed values:

```properties
# application.properties (production)
camel.component.kafka.brokers=localhost:9092

# application.test.properties (test override)
camel.component.kafka.brokers=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP}
```

Citrus loads `application.test.properties` after `application.properties`, so test values override production values. Your route YAML never changes — only the resolved property values differ between environments.

### Variable extraction

Citrus can extract values from received messages and store them as variables for use in later test steps. This is useful for testing routes that generate dynamic values (order IDs, correlation IDs, timestamps):

```yaml
actions:
  - http:
      client: "orderApi"
      send:
        method: POST
        url: "http://localhost:8088/api/orders"
        message:
          body: |
            {"customerId":"C-110","item":"Cargo Net","quantity":5}
  - http:
      client: "orderApi"
      receive:
        status: 200
        extract:
          body:
            $.orderId: generatedOrderId
        message:
          body: |
            {"status":"accepted","orderId":"@notEmpty()@"}

  # Use the extracted variable in a subsequent step
  - echo:
      message: "Created order: ${generatedOrderId}"

  - receive:
      endpoint: "kafka:eip.orders.validated"
      timeout: 10000
      message:
        body: |
          {"orderId":"${generatedOrderId}","customerId":"C-110","item":"Cargo Net","quantity":5}
```

The `extract` block uses a JSON path expression (`$.orderId`) to pull a value from the response body and store it in the variable `generatedOrderId`. Subsequent actions reference it with `${generatedOrderId}`.

## Exporting tests to Maven

The Camel CLI is ideal for prototyping and local testing, but CI/CD pipelines typically need a Maven (or Gradle) project. The `camel export` command generates a complete Maven project from your YAML routes and tests.

### Export command

```bash
camel export --runtime=quarkus --directory=target/exported-project
```

Or for Spring Boot:

```bash
camel export --runtime=spring-boot --directory=target/exported-project
```

### Exported project structure

The generated project follows standard Maven conventions:

```
target/exported-project/
  pom.xml
  src/
    main/
      resources/
        order-validation-route.yaml
        application.properties
    test/
      java/
        OrderValidationTestIT.java
      resources/
        order-validation-test.yaml
        application.test.properties
```

Key details of the exported project:

**pom.xml** includes Citrus dependencies as test-scoped:

```xml
<dependency>
    <groupId>org.citrusframework</groupId>
    <artifactId>citrus-camel</artifactId>
    <version>4.4.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.citrusframework</groupId>
    <artifactId>citrus-kafka</artifactId>
    <version>4.4.0</version>
    <scope>test</scope>
</dependency>
```

**JUnit 5 runner class** wraps the YAML test in a Java test class:

```java
@CitrusSpringConfig
@QuarkusTest
class OrderValidationTestIT {

    @CitrusFramework
    private Citrus citrus;

    @Test
    @CitrusTest
    void orderValidation() {
        citrus.run("order-validation-test.yaml");
    }
}
```

**Maven Failsafe plugin** is configured to run integration tests (classes ending in `IT`):

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <version>3.5.3</version>
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

Run the exported tests with Maven:

```bash
cd target/exported-project
mvn verify
```

This executes the Failsafe plugin's `integration-test` phase, which runs all `*IT.java` test classes. The Citrus tests start Testcontainers, deploy routes, execute scenarios, and report results — the same behavior as `camel test run`, but packaged for CI/CD.

## CI/CD integration

Citrus tests fit naturally into CI/CD pipelines because they are self-contained — each test manages its own infrastructure via Testcontainers. No pre-provisioned Kafka clusters or databases are needed. The pipeline only requires Docker (or a compatible container runtime) for Testcontainers.

### Maven Failsafe configuration

The Failsafe plugin separates integration tests from unit tests. Unit tests run during `mvn test` (Surefire plugin, `*Test.java`), integration tests run during `mvn verify` (Failsafe plugin, `*IT.java`). This separation lets you run fast unit tests on every commit and slower integration tests on merge requests or nightly builds.

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-failsafe-plugin</artifactId>
    <version>3.5.3</version>
    <configuration>
        <systemPropertyVariables>
            <citrus.test.directory>src/test/resources</citrus.test.directory>
        </systemPropertyVariables>
    </configuration>
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

### Docker-in-Docker for CI

Testcontainers needs access to a container runtime. In CI environments, this typically means Docker-in-Docker (DinD) or a mounted Docker socket. Here is a GitHub Actions workflow:

```yaml
name: Integration Tests

on:
  pull_request:
    branches: [main]

jobs:
  citrus-tests:
    runs-on: ubuntu-latest
    services:
      dind:
        image: docker:dind
        options: --privileged
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 25

      - name: Run integration tests
        run: mvn verify -pl examples/41-citrus-testing
        env:
          TESTCONTAINERS_RYUK_DISABLED: true
```

For GitLab CI, use the Docker executor with a DinD service:

```yaml
citrus-integration-tests:
  image: maven:3.9-eclipse-temurin-25
  services:
    - docker:dind
  variables:
    DOCKER_HOST: tcp://docker:2375
    TESTCONTAINERS_RYUK_DISABLED: "true"
  script:
    - mvn verify -pl examples/41-citrus-testing
  rules:
    - if: $CI_MERGE_REQUEST_ID
```

### Parallel test execution

For projects with many integration tests, JUnit 5 supports parallel execution:

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.execution.parallel.enabled=true
junit.jupiter.execution.parallel.mode.default=concurrent
junit.jupiter.execution.parallel.config.fixed.parallelism=4
```

Each test manages its own Testcontainers instances, so parallel execution works without test interference. Be mindful of resource consumption — each test may start one or more containers.

### Test reports

Citrus generates JUnit XML reports compatible with CI/CD systems. The reports appear in `target/failsafe-reports/` and include:

- Test name and duration
- Pass/fail status with failure messages
- Sent and received message details for failed assertions

Most CI systems (GitHub Actions, GitLab CI, Jenkins) can parse JUnit XML and display test results in their UI.

## Citrus vs Camel-native testing

Appendix S and this appendix cover complementary testing approaches. Neither replaces the other — they serve different purposes in the testing pyramid.

| Criterion | Camel-Native (Appendix S) | Citrus (This Appendix) |
|-----------|--------------------------|----------------------|
| Speed | Fast (in-process, no containers) | Slower (container startup, ~10-30s overhead) |
| Infrastructure | Mocked / in-memory | Real (Testcontainers) |
| Scope | Unit / component testing | End-to-end / integration testing |
| Setup | Maven + JUnit + camel-quarkus-junit5 | Camel CLI + test plugin (or exported Maven project) |
| CI/CD | Standard `mvn test` | Maven Failsafe + Docker-in-Docker |
| DSL | Java DSL tests (JUnit classes) | YAML DSL tests (declarative) |
| Route changes | AdviceWith rewires routes for isolation | Routes run unmodified against real endpoints |
| Best for | Route logic correctness | System integration correctness |
| Feedback cycle | Seconds | 30-60 seconds (including container startup) |

### When to use which

**Use Camel-native tests (Appendix S) when:**

- You need fast feedback on route logic — content-based routing, filtering, transformation
- You want to test individual route segments in isolation
- You are developing in a tight code-compile-test loop
- The integration points are well-understood and unlikely to cause surprises

**Use Citrus tests (this appendix) when:**

- You need confidence that the full pipeline works end-to-end
- You have been bitten by serialization mismatches, topic configuration errors, or protocol-level bugs that unit tests miss
- You are testing a route that depends on Kafka consumer group behavior, offset management, or rebalancing
- You are validating a route before deploying to a shared environment
- You want declarative YAML tests that non-developers can read and modify

**Use both when:**

The testing pyramid recommends many fast unit tests at the base and fewer slow integration tests at the top. Write Camel-native tests for every route to cover logic and transformation. Write Citrus tests for critical paths — the order validation pipeline, the payment processing flow, the shipping notification chain — where a production failure would be costly.

A practical split for a Camel project:

```
Unit tests (Camel-native)     — 70% of test suite  — run on every commit
Integration tests (Citrus)    — 25% of test suite  — run on merge requests
End-to-end smoke tests        —  5% of test suite  — run nightly or pre-release
```

## Key takeaways

- **Citrus tests integrations against real infrastructure** — no mocks, no stubs. When a Citrus test passes, the route works with real Kafka, real HTTP endpoints, and real serialization.
- **The Camel CLI test plugin makes YAML-native testing practical** — write routes in YAML, write tests in YAML, run `camel test run`. No Maven project needed for development-time testing.
- **Testcontainers manage infrastructure automatically** — Citrus starts containers, injects connection properties, and tears down containers when the test completes. Your `application.test.properties` file bridges the gap.
- **`camel export` generates CI-ready Maven projects** — the same tests run locally with `camel test run` and in CI with `mvn verify`.
- **Citrus complements Camel-native testing, not replaces it** — use Camel-native tests for fast route logic verification, Citrus tests for end-to-end integration confidence.

## Further reading

- [Citrus Framework documentation](https://citrusframework.org/citrus/reference/4.4.0/html/index.html)
- [Citrus Camel module](https://citrusframework.org/citrus/reference/4.4.0/html/index.html#camel)
- [Apache Camel — Testing with the CLI](https://camel.apache.org/manual/camel-jbang-testing.html)
- [Testcontainers for Java](https://java.testcontainers.org/)
- Appendix S — Testing Strategies for Camel Quarkus (Camel-native testing)
- Appendix U — Camel CLI Deep Dive (CLI installation and commands)

---

*Verification status: unverified. Citrus features reference Citrus 4.4.0 and Apache Camel 4.20.0.*
