---
title: "Appendix W: Citrus Integration Testing"
order: 41
part: appendices
description: "End-to-end integration testing with Citrus — testing Camel routes against real Kafka, HTTP, and database infrastructure using the Camel test plugin."
duration: "35 minutes"
---

Appendix S covered the Camel-native testing toolkit: MockEndpoint for unit testing route logic, AdviceWith for intercepting and rewiring endpoints, REST Assured for HTTP assertions, and Newman for external API contract testing. Those tools verify route behavior in isolation — they replace Kafka brokers with `direct:` and `mock:` endpoints, swap databases for in-memory substitutes, and short-circuit HTTP calls with stubs. The tests run fast, but they cannot catch the bugs that only surface when your route talks to the real thing: serialization mismatches, topic configuration errors, consumer group rebalancing quirks, or HTTP content negotiation failures.

Citrus takes a different approach. It tests integrations **end-to-end against real infrastructure**. A Citrus test spins up a Kafka broker via Testcontainers, launches your Camel route, sends messages to input topics, and verifies that the expected messages appear on output topics. No mocks, no stubs — the same components your route uses in production. When the test passes, you know the route works with real Kafka, real HTTP endpoints, and real serialization.

Citrus integrates with the Camel CLI via the `camel test` plugin command, making it natural to test YAML DSL routes without a Maven project. Write a route in YAML, write a test in YAML, run `camel test run`, and Citrus executes it — starting the infrastructure and the route the test declares, sending and receiving messages, and reporting results. When you are ready for CI/CD, `camel export` generates a Maven project with JUnit 5 test classes and Citrus dependencies included.

The code is in `examples/41-citrus-testing/`.

```bash
camel test run test/order-validation.citrus.it.yaml
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

### Docker Engine for Testcontainers

Citrus starts its infrastructure through **Testcontainers**, which talks to
Docker Engine on `/var/run/docker.sock` (the `default` docker context) — the
same engine the development stack runs on. Nothing needs exporting; the daemon
just has to be up and your user in the `docker` group:

```bash
docker info >/dev/null && echo ok
```

Without it you will see "Could not find a valid Docker environment".

Leave Ryuk, the cleanup sidecar, enabled; disabling it with
`TESTCONTAINERS_RYUK_DISABLED` leaves containers behind when a run is
interrupted.

Finally, shut the dev stack down before running tests. Citrus brings up its own
Kafka, Redis, PostgreSQL and Pulsar on the same ports:

```bash
docker compose -p eip -f examples/_infra/compose.yaml down
```

### Dependencies

There is nothing to declare. `camel test run` inspects the test and adds the Citrus modules it uses: `citrus-kafka` for a test with `kafka:` endpoints, `citrus-http` for one with `http:` actions, and `citrus-camel` for the `camel:` actions that start infrastructure and routes. The run log names them:

```
Resolving Maven dependency: org.citrusframework:citrus-kafka:5.0.0
```

| Module | Purpose |
|--------|---------|
| `citrus-camel` | `camel:` actions — start a Camel infra service, run and verify a route through the Camel CLI |
| `citrus-kafka` | Kafka send and receive actions — publish to topics, consume from topics, assert content and headers |
| `citrus-http` | HTTP client and server actions — send requests, assert responses |

Extra modules (`citrus-sql`, `citrus-jms`, `citrus-mail`, and so on) go on the command line when you need one the test does not reveal: `camel test run --dep=org.citrusframework:citrus-sql:5.0.2 ...`.

**Name test files `*.citrus.yaml` or `*.citrus.it.yaml`.** Citrus only treats a YAML file as a test when its name ends in one of its test suffixes (`.citrus.yaml`, `.citrus.it.yaml`, `.citrus-test.yaml`, ...). Any other name runs nothing:

```
ERROR: No tests to run in current directory
```

### Infrastructure prerequisites

Citrus uses Testcontainers to manage infrastructure on Docker Engine. The first test run pulls container images (Kafka, etc.) — subsequent runs reuse cached images.

To watch a run's infrastructure while it is in progress:

```bash
docker ps
```

### Stop the development stack first

This appendix's Kafka test starts its broker on a random port, so it runs
fine next to the development stack; only its HTTP test needs port 8088 free.
The Maven examples in the other chapters are different. Each one's tests bring up their own infrastructure from
`src/test/resources/_infra/compose.yaml`, on the same fixed host ports the
development stack uses — 9092 for Kafka, 6379 for Redis, 5432 for PostgreSQL,
6650 for Pulsar. The two cannot both be up.

Leaving the development stack running gives you a failure that names the
symptom rather than the cause:

```
ContainerLaunchException: Local Docker Compose exited abnormally with code 1
  whilst running command: compose up -d
```

Further up the container engine's own output is the real reason —
`failed to bind host port 0.0.0.0:9092/tcp: address already in use`. Take the
development stack down before running the tests:

```bash
docker compose -p eip -f examples/_infra/compose.yaml down
```

For the same reason the examples' tests must run one at a time rather than in
parallel across modules; they would otherwise contend for the same ports.

### JMX on the Quarkus test classpath

`citrus-camel` depends on `camel-management`, and Camel switches JMX
management on whenever it finds that jar. In Camel Quarkus the management name
strategy is set up by the `camel-quarkus-management` extension at augmentation
time, so an application that does not use that extension gets the JMX
lifecycle strategy without its configuration and fails to boot:

```
NullPointerException: Cannot invoke ManagementNameStrategy.getName()
  because CamelContext.getManagementNameStrategy() is null
```

Turn JMX off for the test run, in `src/test/resources/application.properties`:

```properties
camel.main.jmx-enabled=false
```

This affects Camel Quarkus only. Camel on Spring Boot configures the strategy
regardless and needs no equivalent setting.

## Test structure

A Citrus test follows a four-step pattern that mirrors the Arrange-Act-Assert structure familiar from unit testing:

1. **Start infrastructure** — a `camel: infra: run:` action starts a service (Kafka, PostgreSQL, Redis, ...) from Camel's own test infrastructure, the same containers `camel infra run` starts by hand, on a random port. It stops again when the test ends.

2. **Launch the integration** — a `camel: jbang: run:` action runs the route under test through the Camel CLI, pointed at that infrastructure; `camel: jbang: verify:` waits until it has started.

3. **Send test messages** — the test produces messages to inputs: Kafka topics, REST endpoints, file directories, or any Camel-supported source.

4. **Verify outcomes** — the test consumes from output topics or endpoints and asserts that the expected messages arrived with the correct body, headers, and structure.

All four steps are actions in the test YAML. Nothing is started for you: a test that only sends and receives finds no broker and no route.

```yaml
name: order-validation-test
description: Verify the order validation route
actions:
  # Step 1: infrastructure (Arrange)
  - camel:
      infra:
        run:
          service: "kafka"

  # Step 2: the route under test, pointed at that Kafka (Arrange)
  - camel:
      jbang:
        run:
          integration:
            name: "order-validation"
            file: "../order-validation-route.yaml"
            systemProperties:
              properties:
                - name: "camel.component.kafka.brokers"
                  value: "${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
  - camel:
      jbang:
        verify:
          integration: "order-validation"
          logMessage: "Routes startup"

  # Step 3: send a test message (Act)
  - send:
      endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
      message:
        body:
          data: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'

  # Step 4: verify the outcome (Assert)
  - receive:
      endpoint: "kafka:eip.orders.validated?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-validated"
      timeout: 20000
      message:
        body:
          data: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
```

The `send` action publishes a message to the endpoint. The `receive` action waits (up to `timeout` milliseconds) for a message on the endpoint and asserts that its body matches. If nothing arrives in time, the test fails. The message body is an object, not a bare string: `body: { data: ... }` for inline content, or `body: { resource: { file: ... } }` for a file.

## Writing tests in YAML

### Generating a test skeleton

The `camel test init` command generates a skeleton test file for an existing route:

```bash
camel test init order-validation-route.yaml
```

This writes a starter test, `test/order-validation-route.yaml` (an `echo` action and a `message` variable), and a `test/citrus-application.properties` that pins the Camel version Citrus runs the route on. It does not read the route's endpoints: you write the actions yourself. Rename the file to `*.citrus.it.yaml` before running it, or Citrus will not pick it up.

### YAML test anatomy

A test file has three top-level fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Test name — used in reports and logs |
| `description` | No | Human-readable description of what the test verifies |
| `actions` | Yes | Ordered list of test steps — executed sequentially |

### Action types

Citrus supports several action types for different testing scenarios:

**`send`** — publish a message to an endpoint. Headers are a list of name/value pairs; the body is `data` (inline) or `resource` (a file):

```yaml
- send:
    endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
    message:
      headers:
        - name: "orderId"
          value: "ORD-001"
      body:
        data: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
```

**`receive`** — consume a message from an endpoint and assert its headers and body:

```yaml
- receive:
    endpoint: "kafka:eip.orders.rejected?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-rejected"
    timeout: 20000
    message:
      headers:
        - name: "rejectionReason"
          value: "customerId must not be null"
      body:
        data: '{"orderId":"ORD-002","item":"Pallet Jack","quantity":1}'
```

**`http`** — send an HTTP request, then assert the response:

```yaml
- http:
    client: "http://localhost:8088"
    sendRequest:
      POST:
        path: "/api/orders"
        contentType: "application/json"
        body:
          data: '{"orderId":"ORD-010","customerId":"C-110","item":"Cargo Net","quantity":5}'
- http:
    client: "http://localhost:8088"
    receiveResponse:
      response:
        status: "200"
        contentType: "application/json"
        body:
          data: '{"status":"accepted","orderId":"ORD-010"}'
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
    endpoint: "kafka:eip.orders.validated?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-validated"
    timeout: 20000
    message:
      body:
        data: '{"orderId":"ORD-001","customerId":"@ignore@","item":"@ignore@","quantity":"@isNumber()@"}'
```

The `@ignore@` placeholder matches any value. Citrus provides several validation matchers:

| Matcher | Description |
|---------|-------------|
| `@ignore@` | Match any value |
| `@isNumber()@` | Match any numeric value |
| `@empty()@` | Match an empty value |
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

### Infrastructure in tests

A test asks for its infrastructure with the `camel: infra: run:` action. It is the same catalogue `camel infra list` shows, started on a random port so it never collides with the development stack, and stopped when the test ends:

```yaml
- camel:
    infra:
      run:
        service: "kafka"
```

Nothing is inferred from the route: a test whose route consumes from `kafka:` still has to start Kafka itself.

### Service property injection

When the service is up, Citrus exposes its connection properties as test variables named `CITRUS_CAMEL_INFRA_<SERVICE>_<PROPERTY>` and logs each one:

```
Starting Camel infra service 'kafka' ...
Exposing service property CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS='localhost:32993'
Successfully started Camel infra service 'kafka'
```

For Kafka the useful one is `CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS` (`CITRUS_CAMEL_INFRA_KAFKA_BROKERS` carries the same address). Use it twice: in the test's own Kafka endpoints (`?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}`), and as a system property on the route the test runs:

```yaml
- camel:
    jbang:
      run:
        integration:
          name: "order-validation"
          file: "../order-validation-route.yaml"
          systemProperties:
            properties:
              - name: "camel.component.kafka.brokers"
                value: "${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
```

The route file never changes: `application.properties` points it at the development stack's `localhost:9092`, and the system property points it at the test's broker.

These variables exist only once the infra action has run. Reference them in actions, not in the test's top-level `variables:` block — that block is resolved before the first action, and fails with `Unknown variable 'CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS'`.

## Testing with Kafka

The core use case for Citrus in a Camel integration project is testing message-driven routes that consume from and produce to Kafka topics. Let us walk through the complete Kafka testing scenario from the example.

### The route under test

The order validation route in `order-validation-route.yaml` consumes from `kafka:eip.orders.incoming`, validates the order payload, and routes to one of two output topics:

- **Valid orders** — enriched with a `validatedAt` header and published to `kafka:eip.orders.validated`
- **Invalid orders** — tagged with a `rejectionReason` header and published to `kafka:eip.orders.rejected`

Validation checks four fields: `orderId` must not be null, `customerId` must not be null, `item` must not be null, and `quantity` must be greater than zero.

### The test

The test file `test/order-validation.citrus.it.yaml` starts Kafka, runs the route against it, and verifies the happy path and three rejections, including the `rejectionReason` header the route sets:

```yaml
name: order-validation-test
description: Verify the order validation route sends valid orders to eip.orders.validated and invalid ones to eip.orders.rejected
actions:
  # Kafka from Camel's own test infrastructure (the same service `camel infra run kafka` starts),
  # on a random port. Citrus exposes its address as CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS.
  - camel:
      infra:
        run:
          service: "kafka"
  - camel:
      jbang:
        run:
          integration:
            name: "order-validation"
            file: "../order-validation-route.yaml"
            systemProperties:
              properties:
                - name: "camel.component.kafka.brokers"
                  value: "${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
  - camel:
      jbang:
        verify:
          integration: "order-validation"
          logMessage: "Routes startup"

  # --- Scenario 1: valid order ---
  - send:
      endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
      message:
        body:
          data: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
  - receive:
      endpoint: "kafka:eip.orders.validated?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-validated"
      timeout: 20000
      message:
        body:
          data: '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'

  # --- Scenario 2: missing customerId ---
  - send:
      endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
      message:
        body:
          data: '{"orderId":"ORD-002","item":"Pallet Jack","quantity":1}'
  - receive:
      endpoint: "kafka:eip.orders.rejected?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-rejected"
      timeout: 20000
      message:
        headers:
          - name: "rejectionReason"
            value: "customerId must not be null"
        body:
          data: '{"orderId":"ORD-002","item":"Pallet Jack","quantity":1}'

  # --- Scenario 3: zero quantity ---
  - send:
      endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
      message:
        body:
          data: '{"orderId":"ORD-003","customerId":"C-102","item":"Cargo Net","quantity":0}'
  - receive:
      endpoint: "kafka:eip.orders.rejected?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-rejected"
      timeout: 20000
      message:
        headers:
          - name: "rejectionReason"
            value: "quantity must be greater than zero"
        body:
          data: '{"orderId":"ORD-003","customerId":"C-102","item":"Cargo Net","quantity":0}'

  # --- Scenario 4: missing item ---
  - send:
      endpoint: "kafka:eip.orders.incoming?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}"
      message:
        body:
          data: '{"orderId":"ORD-004","customerId":"C-103","quantity":5}'
  - receive:
      endpoint: "kafka:eip.orders.rejected?server=${CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS}&consumerGroup=citrus-rejected"
      timeout: 20000
      message:
        headers:
          - name: "rejectionReason"
            value: "item must not be null"
        body:
          data: '{"orderId":"ORD-004","customerId":"C-103","quantity":5}'
```

Each rejection scenario reads `eip.orders.rejected` with the same consumer group, so every `receive` picks up where the previous one stopped.

### Running the test

```bash
cd examples/41-citrus-testing
camel test run test/order-validation.citrus.it.yaml
```

Citrus runs the actions in order:

1. Starts Kafka from Camel's test infrastructure on a random port and exposes `CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS`
2. Runs `order-validation-route.yaml` through the Camel CLI with `camel.component.kafka.brokers` set to that address, and waits for `Routes startup`
3. Sends each order and verifies the topic, body and header it arrives with
4. Stops the route and the broker, and reports the result

The output of a passing run (timestamps trimmed):

```
➤ TEST START: order-validation-test (org.citrusframework.base)
Starting Camel infra service 'kafka' ...
Exposing service property CITRUS_CAMEL_INFRA_KAFKA_BOOTSTRAP_SERVERS='localhost:32993'
Successfully started Camel infra service 'kafka'
✔ camel:run-infra
✔ camel:cli:run
✔ camel:cli:verify
→ OUTBOUND MESSAGE (83 bytes)
✔ send
← INBOUND MESSAGE (83 bytes)
✔ receive
...
✔ camel:stop-infra
✔ camel:cli:stop
✔ TEST SUCCESS: order-validation-test
✔ CITRUS TEST RESULTS
  ✔ SUCCESS (31052ms) order-validation-test
```

The first run is slower: the CLI resolves the Citrus modules and pulls the Kafka image.

### Debugging test failures

A failing action is marked `✘` and the run ends `✘ TEST FAILED`, followed by the cause — a validation difference, or a `receive` that timed out with nothing on the topic.

Common failure causes:

- **No route running** — the test has no `camel: jbang: run:` action, or `verify` timed out because the route failed to start; the route's own output is in `.citrus-jbang/i-<name>-output.txt` when `citrus.camel.jbang.dump.integration.output=true`
- **Route on the wrong broker** — the `camel.component.kafka.brokers` system property is missing, so the route talks to `localhost:9092` instead of the test's Kafka
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

The route under test is `order-http-route.yaml`: a REST endpoint, `POST /api/orders`, that applies the same four checks as the Kafka route and answers straight away — `200` with `{"status":"accepted",...}`, or `400` with the reason. It needs no broker, so the test starts only the route, on the CLI's embedded HTTP server (`--port 8088`; the port is a flag, not a property).

The test file `test/order-http.citrus.it.yaml`:

```yaml
name: order-http-test
description: Verify the HTTP order validation endpoint answers 200 for a valid order and 400 with the reason for an invalid one
actions:
  # No broker needed: the route answers synchronously from the CLI's embedded HTTP server.
  - camel:
      jbang:
        run:
          args:
            - "--port"
            - "8088"
          integration:
            name: "order-http"
            file: "../order-http-route.yaml"
  - camel:
      jbang:
        verify:
          integration: "order-http"
          logMessage: "Routes startup"

  # --- Scenario 1: valid order ---
  - http:
      client: "http://localhost:8088"
      sendRequest:
        POST:
          path: "/api/orders"
          contentType: "application/json"
          body:
            data: '{"orderId":"ORD-010","customerId":"C-110","item":"Cargo Net","quantity":5}'
  - http:
      client: "http://localhost:8088"
      receiveResponse:
        response:
          status: "200"
          contentType: "application/json"
          body:
            data: '{"status":"accepted","orderId":"@notEmpty()@"}'
        # Pull the accepted order id out of the response for later steps.
        extract:
          body:
            - path: "$.orderId"
              variable: "acceptedOrderId"
  - echo:
      message: "Accepted order ${acceptedOrderId}"

  # --- Scenario 2: invalid order (missing item) ---
  - http:
      client: "http://localhost:8088"
      sendRequest:
        POST:
          path: "/api/orders"
          contentType: "application/json"
          body:
            data: '{"orderId":"ORD-011","customerId":"C-111","quantity":3}'
  - http:
      client: "http://localhost:8088"
      receiveResponse:
        response:
          status: "400"
          contentType: "application/json"
          body:
            data: '{"status":"rejected","orderId":"ORD-011","reason":"item must not be null"}'
```

Running the HTTP test:

```bash
camel test run test/order-http.citrus.it.yaml
```

Port 8088 must be free: stop anything else listening on it (another `camel run --port=8088`, for one) before the run.

### REST testing vs message-driven testing

HTTP tests and Kafka tests serve different purposes:

| Aspect | Kafka test | HTTP test |
|--------|-----------|-----------|
| Communication | Asynchronous (fire and verify later) | Synchronous (request-response) |
| Infrastructure | Kafka from `camel: infra: run:` | The CLI's embedded HTTP server (`--port`) |
| Latency tolerance | Must handle consumer lag, rebalancing | Immediate response expected |
| Use case | Message-driven pipelines | REST APIs, webhooks, health endpoints |

For routes that expose both a REST API and Kafka outputs (e.g., accept an order via POST, validate it, and publish to a Kafka topic), combine both test types. Use the HTTP test to verify the synchronous response and the Kafka test to verify the asynchronous downstream output.

## Test variables and property resolution

Citrus variables connect one action to the next. Two kinds show up in this appendix: the infrastructure variables the `camel: infra: run:` action exposes (see [Service property injection](#service-property-injection)), and values a test extracts from a message it received.

### Variable extraction

Citrus can pull a value out of a received message and keep it for later steps, which is how a test follows a generated id through a flow. The HTTP test extracts the accepted order id from the response:

```yaml
  - http:
      client: "http://localhost:8088"
      receiveResponse:
        response:
          status: "200"
          contentType: "application/json"
          body:
            data: '{"status":"accepted","orderId":"@notEmpty()@"}'
        # Pull the accepted order id out of the response for later steps.
        extract:
          body:
            - path: "$.orderId"
              variable: "acceptedOrderId"
  - echo:
      message: "Accepted order ${acceptedOrderId}"
```

`extract` sits next to `response`, not inside it. Each entry takes a JSON path and the variable to store the match in; later actions reference it as `${acceptedOrderId}` (the run logs `Accepted order ORD-010`). `@notEmpty()@` lets the body check pass whatever the id is.

## Exporting tests to Maven

The Camel CLI is ideal for prototyping and local testing, but CI/CD pipelines typically need a Maven (or Gradle) project. `camel export` generates one, and the test plugin carries the Citrus tests across with it.

### Export command

Name every route the tests run; the export only copies the files you give it:

```bash
cd examples/41-citrus-testing
camel export --runtime=quarkus --gav=com.example:order-validation:1.0 \
  --directory=target/exported-project \
  order-validation-route.yaml order-http-route.yaml
```

### Exported project structure

```
target/exported-project/
  pom.xml
  src/
    main/
      resources/
        application.properties
        camel/
          order-http-route.yaml
          order-validation-route.yaml
    test/
      java/com/example/ordervalidation/
        OrderHttpCitrusIT.java
        OrderValidationCitrusIT.java
      resources/
        order-http.citrus.it.yaml
        order-validation.citrus.it.yaml
```

Each YAML test gets a JUnit Jupiter class that runs it, and the tests' route paths are rewritten to the classpath (`camel/order-http-route.yaml`):

```java
@CitrusSupport
public class OrderValidationCitrusIT {

    @Test
    @CitrusTestSource(type = "yaml", sources = "classpath:order-validation.citrus.it.yaml")
    void orderValidationCitrusIT() {}
}
```

### Four fixes before `mvn verify` (Camel 4.22.1)

The project as exported does not build or run its tests. With Camel 4.22.1 it needs four changes, after which both tests pass:

1. **Dependency name.** The pom asks for `org.citrusframework:citrus-junit5`, which Citrus 5 renamed; Maven fails with `Could not find artifact org.citrusframework:citrus-junit5:jar:5.0.0`. Change it to `citrus-junit-jupiter`, and raise `citrus.version` to `5.0.2`.
2. **Missing test modules.** Add, in `test` scope, the modules the tests use that the export left out: `org.citrusframework:citrus-camel`, `citrus-kafka` and `citrus-testcontainers` (`${citrus.version}`), plus `org.apache.camel:camel-test-infra-kafka:4.22.1`. Without the last one the Kafka test fails with `ClassNotFoundException: org.apache.camel.test.infra.kafka.services.KafkaInfraService`.
3. **Camel version.** Add `src/test/resources/citrus-application.properties` with `citrus.camel.jbang.version=4.22.1`. On the exported default the HTTP route never left `Starting`.
4. **Integration tests are skipped.** The Quarkus export sets `<skipITs>true</skipITs>`, so a plain `mvn verify` reports `BUILD SUCCESS` without running anything. Run:

```bash
cd target/exported-project
mvn verify -DskipITs=false
```

```
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.ordervalidation.OrderHttpCitrusIT
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.example.ordervalidation.OrderValidationCitrusIT
[INFO] BUILD SUCCESS
```

Failsafe runs the `*IT` classes; Citrus starts Kafka, runs the routes and reports exactly as `camel test run` does.

## CI/CD integration

Citrus tests fit naturally into CI/CD pipelines because they are self-contained — each test starts its own infrastructure. No pre-provisioned Kafka clusters or databases are needed. The pipeline only requires a Docker daemon for the containers, which GitHub's `ubuntu-latest` runners already have.

### Running the YAML tests in CI

This repository runs them with the Camel CLI, no Maven project involved (`.github/workflows/tests.yml`):

```yaml
- name: Install the Camel CLI and its test plugin
  run: |
    jbang app install --name camel org.apache.camel:camel-launcher:4.22.1
    camel plugin add test
- name: Citrus tests (Appendix W)
  working-directory: examples/41-citrus-testing
  run: |
    camel test run test/order-validation.citrus.it.yaml
    camel test run test/order-http.citrus.it.yaml
```

For an exported project, the step is `mvn verify -DskipITs=false`.

### Parallel test execution

Each Kafka test starts its own broker on a random port, so Kafka tests can run side by side. The HTTP test cannot: it binds the route to the fixed port 8088, and two copies would collide. Keep tests that bind fixed ports in sequence.

### Test reports

The exported project writes JUnit XML to `target/failsafe-reports/`, and Citrus adds its own report under `target/citrus-reports/`: an HTML summary (`citrus-test-results.html`), JUnit XML, and a JSON flow per test (`order-validation-test-flow.json`). Most CI systems (GitHub Actions, GitLab CI, Jenkins) can parse the JUnit XML and display results in their UI.

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
- **The test declares its infrastructure** — `camel: infra: run:` starts Kafka (or another service) on a random port, Citrus exposes its address as `CITRUS_CAMEL_INFRA_*` variables, and a system property on `camel: jbang: run:` points the unchanged route at it.
- **`camel export` generates CI-ready Maven projects** — the same tests run locally with `camel test run` and in CI with `mvn verify`.
- **Citrus complements Camel-native testing, not replaces it** — use Camel-native tests for fast route logic verification, Citrus tests for end-to-end integration confidence.

## Further reading

- [Citrus Framework documentation](https://citrusframework.org/citrus/reference/5.0.1/html/index.html)
- [Citrus Camel module](https://citrusframework.org/citrus/reference/5.0.1/html/index.html#camel)
- [Apache Camel — Testing with the CLI](https://camel.apache.org/manual/camel-jbang.html)
- [Testcontainers for Java](https://java.testcontainers.org/)
- Appendix S — Testing Strategies for Camel Quarkus (Camel-native testing)
- Appendix U — Camel CLI Deep Dive (CLI installation and commands)

---

*Verification status: <span class="status status--verified">verified</span> — with Camel CLI 4.22.1 and the `test` plugin on Docker Engine, both tests pass through `camel test run` — the Kafka test (its own broker, the valid order and three rejections with their `rejectionReason` header) and the HTTP test (200 and 400 answers, extracted order id) — and pass again in the project `camel export` generates once the four fixes above are applied (`mvn verify -DskipITs=false`) (2026-10-09).*
