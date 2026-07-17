# EIP Testing Strategies

Three-tier testing strategy for Camel routes — unit tests with MockEndpoint and AdviceWith, integration tests with Dev Services and REST Assured, and black-box API tests with Newman. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

Companion code for **Appendix S: Testing Strategies**.

## What's inside

### Routes under test

| Route | Pattern | Entry point |
|-------|---------|-------------|
| `OrderValidationRoute` | Content-based router (domestic/intl/hazmat) | `direct:validate-order` |
| `OrderFilterRoute` | Message filter (amount ≥ $100) | `direct:filter-order` |
| `OrderEnrichmentRoute` | Content enricher via CDI bean | `direct:enrich-order` |
| `PaymentGatewayRoute` | REST DSL smart proxy (mock/production) | `POST /api/payments/process` |

### Test tiers

| Tier | Tests | What they cover |
|------|-------|-----------------|
| **1 — Unit** | `OrderValidationRouteTest`, `OrderFilterRouteTest`, `OrderEnrichmentRouteTest`, `PaymentGatewayUnitTest` | Route logic with mocked endpoints, no infrastructure |
| **2 — Integration** | `PaymentGatewayIT`, `KafkaIntegrationTest`, `PaymentGatewayNativeIT` | REST Assured, real Kafka via Dev Services, packaged artifact |
| **3 — Newman** | `eip-testing-collection.json` | External black-box API tests via Postman/Newman |

## Prerequisites

- Java 25+
- Maven 3.9+
- For Tier 3: Node.js and Newman (`npm install -g newman`)

## Running

### Tier 1 — Unit tests (no infrastructure needed)

```bash
# Quarkus
cd examples/37-testing-strategies/quarkus
mvn test

# Spring Boot
cd examples/37-testing-strategies/spring-boot
mvn test
```

### Tier 2 — Integration tests (Dev Services auto-starts Kafka)

```bash
# Quarkus
cd examples/37-testing-strategies/quarkus
mvn verify

# Spring Boot
cd examples/37-testing-strategies/spring-boot
mvn verify
```

### Tier 3 — Newman tests

Start the app in one terminal:

```bash
# Quarkus
cd examples/37-testing-strategies/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/37-testing-strategies/spring-boot
mvn spring-boot:run
```

In another terminal:

```bash
newman run src/test/resources/postman/eip-testing-collection.json \
  -e src/test/resources/postman/local-env.json
```

Or via Maven (requires Newman installed):

```bash
mvn verify -Pnewman
```

---

*Verification status: unverified. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
