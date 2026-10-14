# Appendix W: Citrus Integration Testing

End-to-end integration testing for Camel routes using Citrus.

## How Citrus differs from Appendix S testing

Appendix S covers Camel-native testing — MockEndpoint, AdviceWith, REST Assured, and
Newman. Those tools verify route logic in isolation by replacing real endpoints with mocks
and in-memory substitutes. Citrus takes the opposite approach: it tests your routes against
**real infrastructure**. Citrus spins up Kafka brokers, HTTP servers, and databases via
Testcontainers, launches your Camel route against them, sends messages to real topics and
endpoints, and verifies that expected outputs appear on real output topics and responses.

## Prerequisites

- JBang with the Camel CLI installed (`jbang app install --name camel org.apache.camel:camel-launcher:4.22.1`)
- Java 25+
- Docker Engine on the default context (for Testcontainers-managed infrastructure)

## Setup

Install the Camel test plugin:

```bash
camel plugin add test
```

## Running tests

```bash
# Run the Kafka integration test (starts Kafka on the default fixed port)
camel test run test/order-validation.citrus.it.yaml

# Run the HTTP endpoint test (no broker; the route answers on port 8088)
camel test run test/order-http.citrus.it.yaml
```

Citrus only runs YAML tests whose names end in `.citrus.yaml`, `.citrus.it.yaml`
or `.citrus-test.yaml`; any other name gives `No tests to run in current directory`.
The test plugin adds the Citrus modules each test needs (`citrus-kafka`,
`citrus-http`) by itself; there is nothing to declare.

## Files

| File                                   | Purpose |
|----------------------------------------|---------|
| `order-validation-route.camel.yaml`    | Camel route that validates incoming orders from Kafka |
| `order-http-route.camel.yaml`          | Camel route that validates orders POSTed to `/api/orders` and answers 200 or 400 |
| `test/order-validation.citrus.it.yaml` | Citrus test — starts Kafka (`camel infra`), runs the route, verifies routing and the `rejectionReason` header |
| `test/order-http.citrus.it.yaml`       | Citrus test — runs the HTTP route, verifies the 200 and 400 responses |
| `application.properties`               | Kafka and REST configuration for running the routes by hand against the compose stack |

---

*Verification status: unverified.*
