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

- JBang with the Camel CLI installed (`jbang app install camel@apache/camel`)
- Java 25+
- Docker or Podman (for Testcontainers-managed infrastructure)

## Setup

Install the Camel test plugin:

```bash
camel plugin add test
```

## Running tests

```bash
# Run the Kafka integration test
camel test run test/order-validation-test.yaml

# Run the HTTP endpoint test
camel test run test/order-http-test.yaml
```

## Files

| File | Purpose |
|------|---------|
| `order-validation-route.yaml` | Camel route that validates incoming orders from Kafka |
| `test/order-validation-test.yaml` | Citrus test — sends orders to Kafka, verifies routing |
| `test/order-http-test.yaml` | Citrus test — validates orders via REST endpoint |
| `jbang.properties` | Citrus dependency declarations for JBang |
| `application.properties` | Kafka and REST configuration |
| `application.test.properties` | Test overrides (Testcontainers-managed broker) |

---

*Verification status: unverified.*
