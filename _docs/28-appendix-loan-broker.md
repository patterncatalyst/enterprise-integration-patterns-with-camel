---
title: "Appendix J: The Loan Broker Case Study"
order: 28
part: appendices
description: "A complete EIP case study — the classic Loan Broker from Hohpe & Woolf, reimagined with Apache Camel, Kafka, and the shipping domain."
duration: "45 minutes"
---

The Loan Broker is the original end-to-end EIP case study from *Enterprise Integration Patterns*. It combines nearly every major pattern: Content-Based Router, Recipient List, Scatter-Gather, Aggregator, Message Translator, and more. This appendix rebuilds the Loan Broker with Camel on Quarkus, using Kafka as the messaging backbone — and then maps its lessons back to our shipping domain.

{% include excalidraw.html file="28-loan-broker" alt="Loan Broker Scatter-Gather architecture" caption="Figure J.1 — The Loan Broker: gateway, enricher, recipient list, bank services, and aggregator." %}

## The Loan Broker problem

A customer wants the best loan rate. The broker must:
1. Receive a loan request (amount, term, credit score).
2. Enrich the request with a credit bureau lookup.
3. Determine which banks can service this request (Recipient List based on loan criteria).
4. Fan out the enriched request to qualifying banks (Scatter-Gather).
5. Collect all bank replies within a timeout (Aggregator with completion conditions).
6. Select the best offer and return it to the customer.

This is a textbook integration problem: multiple external systems, asynchronous replies, timeout handling, and result aggregation.

## Architecture

## Kafka topics

| Topic | Purpose |
|-------|---------|
| `loan.requests` | Incoming loan requests from customers |
| `loan.enriched` | Requests enriched with credit bureau data |
| `loan.bank.request.<bankId>` | Per-bank request topics |
| `loan.bank.reply` | All bank replies (correlated by request ID) |
| `loan.results` | Best-offer results back to the customer |

## The data model

```java
public record LoanRequest(
    String requestId,
    String customerId,
    double amount,
    int termMonths,
    int creditScore
) {}

public record EnrichedLoanRequest(
    String requestId,
    String customerId,
    double amount,
    int termMonths,
    int creditScore,
    String creditHistory,   // from credit bureau
    double debtToIncome,    // from credit bureau
    List<String> eligibleBanks
) {}

public record BankQuote(
    String requestId,
    String bankId,
    String bankName,
    double interestRate,
    double monthlyPayment,
    double totalCost,
    boolean approved,
    String conditions
) {}

public record LoanResult(
    String requestId,
    String customerId,
    BankQuote bestOffer,
    List<BankQuote> allOffers,
    int totalResponses,
    int totalBanksQueried
) {}
```

## Step 1: The Messaging Gateway

The gateway receives HTTP loan requests and publishes them to Kafka:

```java
from("platform-http:/api/loans?httpMethodRestrict=POST")
    .routeId("loan-gateway")
    .unmarshal().json(LoanRequest.class)
    .process(exchange -> {
        LoanRequest request = exchange.getIn().getBody(LoanRequest.class);
        if (request.requestId() == null) {
            exchange.getIn().setBody(new LoanRequest(
                UUID.randomUUID().toString(),
                request.customerId(),
                request.amount(),
                request.termMonths(),
                request.creditScore()
            ));
        }
    })
    .setHeader(KafkaConstants.KEY, simple("${body.requestId}"))
    .marshal().json()
    .to("kafka:loan.requests?brokers=localhost:9092")
    .setHeader(Exchange.HTTP_RESPONSE_CODE, constant(202))
    .setBody(simple("{\"requestId\": \"${header.CamelKafkaRecordKey}\", \"status\": \"processing\"}"));
```

**Pattern: Messaging Gateway.** The REST endpoint shields the customer from the asynchronous messaging system. The customer gets an immediate 202 Accepted with a request ID for polling.

## Step 2: Content Enricher — Credit Bureau

Enrich the loan request with credit bureau data:

```java
from("kafka:loan.requests?brokers=localhost:9092&groupId=loan-enricher")
    .routeId("credit-bureau-enricher")
    .unmarshal().json(LoanRequest.class)
    .enrich("direct:credit-bureau-lookup", (oldExchange, newExchange) -> {
        LoanRequest request = oldExchange.getIn().getBody(LoanRequest.class);
        Map<String, Object> credit = newExchange.getIn().getBody(Map.class);
        EnrichedLoanRequest enriched = new EnrichedLoanRequest(
            request.requestId(),
            request.customerId(),
            request.amount(),
            request.termMonths(),
            request.creditScore(),
            (String) credit.get("credit_history"),
            ((Number) credit.get("debt_to_income")).doubleValue(),
            List.of() // banks determined in next step
        );
        oldExchange.getIn().setBody(enriched);
        return oldExchange;
    })
    .setHeader(KafkaConstants.KEY, simple("${body.requestId}"))
    .marshal().json()
    .to("kafka:loan.enriched?brokers=localhost:9092");

from("direct:credit-bureau-lookup")
    .routeId("credit-bureau-call")
    .setHeader(Exchange.HTTP_METHOD, constant("GET"))
    .setHeader(Exchange.HTTP_PATH, simple("/api/credit/${body.customerId}"))
    .to("http://credit-bureau:8080")
    .unmarshal().json(Map.class);
```

**Pattern: Content Enricher.** The `enrich()` DSL fetches credit bureau data and merges it into the loan request using an `AggregationStrategy`.

## Step 3: Recipient List — Bank selection

Determine which banks qualify for this loan and fan out requests:

```java
from("kafka:loan.enriched?brokers=localhost:9092&groupId=loan-router")
    .routeId("bank-recipient-list")
    .unmarshal().json(EnrichedLoanRequest.class)
    .process(exchange -> {
        EnrichedLoanRequest request = exchange.getIn().getBody(EnrichedLoanRequest.class);
        List<String> eligible = new ArrayList<>();

        // Bank A: any loan, no credit restriction
        eligible.add("bank-a");

        // Bank B: credit score >= 650, max $500k
        if (request.creditScore() >= 650 && request.amount() <= 500_000) {
            eligible.add("bank-b");
        }

        // Bank C: prime only — credit score >= 720, low DTI
        if (request.creditScore() >= 720 && request.debtToIncome() < 0.36) {
            eligible.add("bank-c");
        }

        // Bank D: high-value loans only — $100k minimum
        if (request.amount() >= 100_000) {
            eligible.add("bank-d");
        }

        exchange.getIn().setHeader("eligibleBanks", String.join(",", eligible));
        exchange.getIn().setHeader("totalBanksQueried", eligible.size());
        exchange.getIn().setHeader("CamelKafkaKey", request.requestId());
    })
    .recipientList(method("bankEndpointResolver", "resolve"))
    .parallelProcessing()
    .timeout(10000);

@ApplicationScoped
@Named("bankEndpointResolver")
public class BankEndpointResolver {

    public List<String> resolve(@Header("eligibleBanks") String banks) {
        return Arrays.stream(banks.split(","))
            .map(bank -> "kafka:loan.bank.request." + bank + "?brokers=localhost:9092")
            .toList();
    }
}
```

**Pattern: Recipient List.** The list of banks is computed dynamically based on the enriched request data — credit score, amount, and debt-to-income ratio. Each qualifying bank gets its own Kafka topic.

## Step 4: Bank services

Each bank consumes from its request topic, evaluates the loan, and publishes a quote to the shared reply topic:

```java
from("kafka:loan.bank.request.bank-a?brokers=localhost:9092&groupId=bank-a")
    .routeId("bank-a-service")
    .unmarshal().json(EnrichedLoanRequest.class)
    .process(exchange -> {
        EnrichedLoanRequest request = exchange.getIn().getBody(EnrichedLoanRequest.class);
        double baseRate = 5.5;
        // Bank A adjusts rate based on credit score
        double adjustment = (750 - request.creditScore()) * 0.01;
        double rate = Math.max(baseRate + adjustment, 3.5);
        double monthlyPayment = calculateMonthly(request.amount(), rate, request.termMonths());
        BankQuote quote = new BankQuote(
            request.requestId(), "bank-a", "First National Bank",
            rate, monthlyPayment, monthlyPayment * request.termMonths(),
            true, request.amount() > 250_000 ? "Requires appraisal" : "Pre-approved"
        );
        exchange.getIn().setBody(quote);
    })
    .setHeader(KafkaConstants.KEY, simple("${body.requestId}"))
    .marshal().json()
    .to("kafka:loan.bank.reply?brokers=localhost:9092");
```

Each bank has its own pricing algorithm, approval criteria, and conditions. The key point: they all publish to the same `loan.bank.reply` topic, keyed by request ID for aggregation.

## Step 5: Aggregator — Collect and select

Aggregate bank replies, selecting the best offer:

```java
from("kafka:loan.bank.reply?brokers=localhost:9092&groupId=loan-aggregator")
    .routeId("loan-offer-aggregator")
    .unmarshal().json(BankQuote.class)
    .aggregate(simple("${body.requestId}"), new BestLoanOfferStrategy())
        .completionSize(header("totalBanksQueried"))
        .completionTimeout(15000)
        .completionTimeoutExpression(header("aggregationTimeout"))
    .marshal().json()
    .to("kafka:loan.results?brokers=localhost:9092");

public class BestLoanOfferStrategy implements AggregationStrategy {

    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        BankQuote newQuote = newExchange.getIn().getBody(BankQuote.class);

        if (oldExchange == null) {
            LoanResult result = new LoanResult(
                newQuote.requestId(), null, newQuote,
                new ArrayList<>(List.of(newQuote)), 1, 0
            );
            newExchange.getIn().setBody(result);
            return newExchange;
        }

        LoanResult result = oldExchange.getIn().getBody(LoanResult.class);
        List<BankQuote> allOffers = new ArrayList<>(result.allOffers());
        allOffers.add(newQuote);

        BankQuote bestOffer = allOffers.stream()
            .filter(BankQuote::approved)
            .min(Comparator.comparingDouble(BankQuote::interestRate))
            .orElse(result.bestOffer());

        LoanResult updated = new LoanResult(
            result.requestId(), result.customerId(),
            bestOffer, allOffers,
            result.totalResponses() + 1,
            result.totalBanksQueried()
        );
        oldExchange.getIn().setBody(updated);
        return oldExchange;
    }
}
```

**Pattern: Aggregator (Scatter-Gather).** The aggregator collects replies correlated by `requestId`. It completes when either all expected bank replies arrive (`completionSize`) or the 15-second timeout expires — whichever comes first. The aggregation strategy selects the lowest interest rate among approved offers.

## Step 6: Result Gateway

Return the best offer to the customer via a polling endpoint:

```java
@ApplicationScoped
public class LoanResultStore {

    private final Map<String, LoanResult> results = new ConcurrentHashMap<>();

    public void store(String requestId, LoanResult result) {
        results.put(requestId, result);
    }

    public Optional<LoanResult> get(String requestId) {
        return Optional.ofNullable(results.get(requestId));
    }
}

// Consumer that populates the result store
from("kafka:loan.results?brokers=localhost:9092&groupId=loan-result-store")
    .routeId("loan-result-consumer")
    .unmarshal().json(LoanResult.class)
    .bean("loanResultStore", "store(${body.requestId}, ${body})");

// Polling endpoint
from("platform-http:/api/loans/{requestId}?httpMethodRestrict=GET")
    .routeId("loan-result-gateway")
    .process(exchange -> {
        String requestId = exchange.getIn().getHeader("requestId", String.class);
        Optional<LoanResult> result = exchange.getContext()
            .getRegistry().lookupByNameAndType("loanResultStore", LoanResultStore.class)
            .get(requestId);
        if (result.isPresent()) {
            exchange.getIn().setBody(result.get());
            exchange.getIn().setHeader(Exchange.CONTENT_TYPE, "application/json");
        } else {
            exchange.getIn().setHeader(Exchange.HTTP_RESPONSE_CODE, 404);
            exchange.getIn().setBody("{\"status\": \"processing\", \"message\": \"Results not yet available\"}");
        }
    })
    .marshal().json();
```

## Pattern inventory

This case study uses these EIP patterns:

| Pattern | Where |
|---------|-------|
| **Messaging Gateway** | REST → Kafka gateway, result polling endpoint |
| **Content Enricher** | Credit bureau lookup |
| **Content-Based Router** | Bank eligibility rules |
| **Recipient List** | Dynamic bank fan-out |
| **Scatter-Gather** | Parallel bank requests + aggregation |
| **Aggregator** | Collect bank quotes, select best |
| **Correlation Identifier** | `requestId` across all messages |
| **Message Expiration** | Aggregation timeout (15s) |
| **Request-Reply** | Customer submits → polls for result |
| **Return Address** | Reply topic (`loan.bank.reply`) |
| **Message Translator** | JSON ↔ Java record conversions |
| **Document Message** | Enriched loan request is a self-contained document |
| **Event Message** | Bank quote arrivals trigger aggregation |

## Mapping to the shipping domain

The Loan Broker maps directly to shipping scenarios:

| Loan Broker | Shipping Domain |
|-------------|-----------------|
| Customer submits loan request | Customer places order |
| Credit bureau enrichment | Address validation + customs classification |
| Bank eligibility rules | Carrier eligibility (weight, dimensions, hazmat, destination) |
| Fan out to qualifying banks | Fan out to qualifying carriers (FedEx, UPS, USPS, DHL) |
| Bank quotes | Carrier rate quotes |
| Aggregate best rate | Select cheapest / fastest / best-value carrier |
| Timeout (not all banks reply) | Timeout (slow carrier APIs) |

A shipping rate aggregator built on Camel would follow the exact same pattern topology:

```java
// Carrier Scatter-Gather
from("kafka:eip.shipping.rate-requests?brokers=localhost:9092&groupId=carrier-scatter")
    .routeId("carrier-scatter-gather")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> shipment = exchange.getIn().getBody(Map.class);
        List<String> eligible = new ArrayList<>();
        double weight = ((Number) shipment.get("weight_kg")).doubleValue();
        boolean hazmat = Boolean.TRUE.equals(shipment.get("contains_hazmat"));
        String country = (String) shipment.get("destination_country");

        eligible.add("carrier-usps");
        if (weight <= 70) eligible.add("carrier-fedex");
        if (!hazmat) eligible.add("carrier-ups");
        if ("US".equals(country) || "CA".equals(country)) eligible.add("carrier-dhl");

        exchange.getIn().setHeader("eligibleCarriers",
            eligible.stream()
                .map(c -> "kafka:eip.carrier.request." + c + "?brokers=localhost:9092")
                .collect(Collectors.joining(",")));
        exchange.getIn().setHeader("totalCarriers", eligible.size());
    })
    .recipientList(header("eligibleCarriers")).parallelProcessing().timeout(10000)
    .end();
```

## Lessons from the Loan Broker

1. **Scatter-Gather is the natural shape of comparison shopping** — any time you need quotes, bids, or evaluations from multiple providers, this pattern applies.

2. **Correlation is everything.** Without the `requestId` flowing through every message (Kafka key, aggregation correlation, result lookup), the system cannot reassemble a coherent answer from scattered replies.

3. **Timeouts are a feature, not an edge case.** Not all banks (or carriers) will reply. The aggregator's `completionTimeout` ensures the customer gets *some* answer even when a provider is slow or down. Design for partial results from the start.

4. **The Recipient List makes the system extensible.** Adding a new bank (or carrier) means adding one eligibility rule and one consumer — no changes to the core flow.

5. **Enrichment before routing is a common prerequisite.** The credit bureau lookup happens before bank selection because the selection depends on enriched data. In the shipping domain, customs classification must happen before carrier selection for international shipments.

---

*Verification status: <span class="status status--verified">verified</span> against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11).*
