---
title: "Appendix K: Bond Trading Case Study"
order: 29
part: appendices
description: "A second EIP case study — real-time bond pricing, market data distribution, and trade execution with Camel and Kafka."
duration: "40 minutes"
---

The Loan Broker (Appendix J) showed how Scatter-Gather solves comparison shopping. This case study tackles a different integration challenge: real-time data distribution. A bond trading platform must ingest market data from multiple feeds, normalize it into a canonical format, route it to interested subscribers, and execute trades — all with low latency and guaranteed delivery.

## The bond trading problem

A trading desk needs:
1. **Market data ingestion** — receive bond prices from multiple feeds (Bloomberg, Reuters, exchange feeds) in different formats.
2. **Normalization** — translate all feeds into a single canonical price format.
3. **Distribution** — route prices to subscribers based on their interest profiles (bond type, issuer, maturity range).
4. **Trade execution** — accept trade orders, validate against current prices, route to the appropriate execution venue, and confirm.
5. **Position tracking** — maintain real-time portfolio positions as trades execute.

## Architecture

```
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Feed A    │  │ Feed B    │  │ Feed C    │
│(Bloomberg)│  │(Reuters)  │  │(Exchange) │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      ▼              ▼              ▼
┌──────────────────────────────────────────┐
│         Channel Adapter Layer            │
│    (normalize to canonical format)       │
└──────────────────────┬───────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  Canonical     │
              │  Price Topic   │
              └───────┬────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌─────────┐
   │Subscriber│  │Subscriber│  │ Trading │
   │ Desk A  │  │ Desk B   │  │ Engine  │
   └─────────┘  └──────────┘  └─────────┘
```

## Kafka topics

| Topic | Purpose | Partitioning |
|-------|---------|-------------|
| `bond.feed.raw.<source>` | Raw market data per feed | By bond ISIN |
| `bond.prices.canonical` | Normalized prices | By bond ISIN |
| `bond.prices.filtered.<desk>` | Per-desk filtered prices | By bond ISIN |
| `bond.orders.new` | New trade orders | By portfolio ID |
| `bond.orders.validated` | Validated orders ready for execution | By venue |
| `bond.trades.executed` | Executed trade confirmations | By portfolio ID |
| `bond.positions.updates` | Position change events | By portfolio ID |

## The data model

```java
public record RawPriceUpdate(
    String source,       // "bloomberg", "reuters", "exchange"
    String bondId,       // source-specific identifier
    double bidPrice,
    double askPrice,
    double midPrice,
    int bidSize,
    int askSize,
    long sourceTimestamp,
    Map<String, String> sourceMetadata
) {}

public record CanonicalPrice(
    String isin,          // ISO 6166 identifier
    String issuer,
    String bondType,      // "government", "corporate", "municipal"
    String currency,
    double couponRate,
    String maturityDate,
    double bidPrice,
    double askPrice,
    double bidYield,
    double askYield,
    int bidSize,
    int askSize,
    String bestSource,
    long timestamp
) {}

public record TradeOrder(
    String orderId,
    String portfolioId,
    String traderId,
    String isin,
    String side,         // "BUY" or "SELL"
    int quantity,
    double limitPrice,
    String orderType,    // "MARKET", "LIMIT"
    long submittedAt
) {}

public record TradeExecution(
    String executionId,
    String orderId,
    String portfolioId,
    String isin,
    String side,
    int quantity,
    double executedPrice,
    String venue,
    long executedAt,
    String status        // "FILLED", "PARTIAL", "REJECTED"
) {}
```

## Pattern 1: Channel Adapter — Market data ingestion

Each market data source has its own format. Channel Adapters normalize them:

```java
// Bloomberg feed — FIX-like delimited format
from("kafka:bond.feed.raw.bloomberg?brokers=localhost:9092&groupId=feed-normalizer")
    .routeId("bloomberg-channel-adapter")
    .unmarshal().json(RawPriceUpdate.class)
    .bean("bloombergNormalizer", "normalize")
    .setHeader(KafkaConstants.KEY, simple("${body.isin}"))
    .marshal().json()
    .to("kafka:bond.prices.canonical?brokers=localhost:9092");

// Reuters feed — different field names, different identifiers
from("kafka:bond.feed.raw.reuters?brokers=localhost:9092&groupId=feed-normalizer")
    .routeId("reuters-channel-adapter")
    .unmarshal().json(RawPriceUpdate.class)
    .bean("reutersNormalizer", "normalize")
    .setHeader(KafkaConstants.KEY, simple("${body.isin}"))
    .marshal().json()
    .to("kafka:bond.prices.canonical?brokers=localhost:9092");
```

**Pattern: Channel Adapter + Message Translator.** Each adapter translates a source-specific format into the canonical `CanonicalPrice` record. The normalizer beans handle identifier mapping (Bloomberg FIGI → ISIN), field renaming, and yield calculation.

```java
@ApplicationScoped
@Named("bloombergNormalizer")
public class BloombergNormalizer {

    @Inject
    @Named("isinMapper")
    Map<String, String> figiToIsin;

    public CanonicalPrice normalize(RawPriceUpdate raw) {
        String isin = figiToIsin.getOrDefault(raw.bondId(), raw.bondId());
        double bidYield = priceToYield(raw.bidPrice(), /* coupon, maturity from reference data */);
        double askYield = priceToYield(raw.askPrice(), /* coupon, maturity from reference data */);
        return new CanonicalPrice(
            isin, /* issuer from ref data */, /* type from ref data */,
            "USD", /* coupon */, /* maturity */,
            raw.bidPrice(), raw.askPrice(),
            bidYield, askYield,
            raw.bidSize(), raw.askSize(),
            "bloomberg", raw.sourceTimestamp()
        );
    }
}
```

## Pattern 2: Normalizer — Best-price selection

When the same bond arrives from multiple feeds, select the best bid/ask:

```java
from("kafka:bond.prices.canonical?brokers=localhost:9092&groupId=best-price-normalizer")
    .routeId("best-price-normalizer")
    .unmarshal().json(CanonicalPrice.class)
    .aggregate(simple("${body.isin}"), new BestPriceStrategy())
        .completionInterval(500)    // aggregate within 500ms windows
        .completionTimeout(1000)
    .marshal().json()
    .to("kafka:bond.prices.best?brokers=localhost:9092");

public class BestPriceStrategy implements AggregationStrategy {

    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        if (oldExchange == null) return newExchange;

        CanonicalPrice existing = oldExchange.getIn().getBody(CanonicalPrice.class);
        CanonicalPrice incoming = newExchange.getIn().getBody(CanonicalPrice.class);

        // Best price = highest bid, lowest ask (tightest spread)
        CanonicalPrice best = new CanonicalPrice(
            existing.isin(), existing.issuer(), existing.bondType(),
            existing.currency(), existing.couponRate(), existing.maturityDate(),
            Math.max(existing.bidPrice(), incoming.bidPrice()),
            Math.min(existing.askPrice(), incoming.askPrice()),
            existing.bidPrice() >= incoming.bidPrice() ? existing.bidYield() : incoming.bidYield(),
            existing.askPrice() <= incoming.askPrice() ? existing.askYield() : incoming.askYield(),
            Math.max(existing.bidSize(), incoming.bidSize()),
            Math.max(existing.askSize(), incoming.askSize()),
            existing.bidPrice() >= incoming.bidPrice() ? existing.bestSource() : incoming.bestSource(),
            Math.max(existing.timestamp(), incoming.timestamp())
        );
        oldExchange.getIn().setBody(best);
        return oldExchange;
    }
}
```

**Pattern: Normalizer + Aggregator.** The Normalizer pattern selects the best composite price from multiple sources within a time window. This is different from the Loan Broker's aggregator (which waits for all replies) — here we aggregate by time window because market data is continuous.

## Pattern 3: Content-Based Router — Desk distribution

Route prices to trading desks based on their subscription profiles:

```java
from("kafka:bond.prices.best?brokers=localhost:9092&groupId=desk-distributor")
    .routeId("desk-price-distributor")
    .unmarshal().json(CanonicalPrice.class)
    .multicast().parallelProcessing()
        .to("direct:filter-desk-a", "direct:filter-desk-b", "direct:filter-desk-c")
    .end();

// Desk A: government bonds only
from("direct:filter-desk-a")
    .routeId("desk-a-filter")
    .filter(simple("${body.bondType} == 'government'"))
    .setHeader(KafkaConstants.KEY, simple("${body.isin}"))
    .marshal().json()
    .to("kafka:bond.prices.filtered.desk-a?brokers=localhost:9092");

// Desk B: corporate bonds, investment grade
from("direct:filter-desk-b")
    .routeId("desk-b-filter")
    .filter(simple("${body.bondType} == 'corporate'"))
    .setHeader(KafkaConstants.KEY, simple("${body.isin}"))
    .marshal().json()
    .to("kafka:bond.prices.filtered.desk-b?brokers=localhost:9092");

// Desk C: all bonds with maturity within 5 years
from("direct:filter-desk-c")
    .routeId("desk-c-filter")
    .filter().method("maturityFilter", "isWithinYears(5)")
    .setHeader(KafkaConstants.KEY, simple("${body.isin}"))
    .marshal().json()
    .to("kafka:bond.prices.filtered.desk-c?brokers=localhost:9092");
```

**Patterns: Publish-Subscribe (Multicast) + Message Filter.** The multicast sends every price update to all desk filters. Each filter applies its subscription criteria and publishes only matching prices to the desk's topic. This is the Publish-Subscribe Channel pattern combined with Selective Consumer.

## Pattern 4: Message Filter + Validator — Trade order validation

Validate incoming trade orders before execution:

```java
from("kafka:bond.orders.new?brokers=localhost:9092&groupId=order-validator")
    .routeId("trade-order-validator")
    .unmarshal().json(TradeOrder.class)
    // Idempotent check — reject duplicate order IDs
    .idempotentConsumer(simple("${body.orderId}"),
        MemoryIdempotentRepository.memoryIdempotentRepository(10000))
    // Validate against current market price
    .enrich("direct:current-price-lookup", (oldExchange, newExchange) -> {
        TradeOrder order = oldExchange.getIn().getBody(TradeOrder.class);
        CanonicalPrice price = newExchange.getIn().getBody(CanonicalPrice.class);
        oldExchange.getIn().setHeader("currentBid", price.bidPrice());
        oldExchange.getIn().setHeader("currentAsk", price.askPrice());
        oldExchange.getIn().setHeader("marketOpen", price.timestamp() > System.currentTimeMillis() - 60000);
        return oldExchange;
    })
    .choice()
        .when(header("marketOpen").isEqualTo(false))
            .log("REJECTED: Stale market data for ${body.isin}")
            .to("direct:reject-order")
        .when(simple("${body.side} == 'BUY' && ${body.orderType} == 'LIMIT'"
                + " && ${body.limitPrice} < ${header.currentAsk}"))
            .log("LIMIT BUY below ask — holding for fill: ${body.orderId}")
            .to("direct:hold-limit-order")
        .otherwise()
            .setHeader(KafkaConstants.KEY, simple("${body.orderId}"))
            .marshal().json()
            .to("kafka:bond.orders.validated?brokers=localhost:9092")
    .end();
```

**Patterns: Idempotent Receiver + Content Enricher + Content-Based Router.** The order pipeline deduplicates, enriches with current market data, and routes based on validation rules.

## Pattern 5: Routing Slip — Trade execution

Different bonds execute on different venues. The execution path is determined at runtime:

```java
from("kafka:bond.orders.validated?brokers=localhost:9092&groupId=trade-executor")
    .routeId("trade-execution-routing-slip")
    .unmarshal().json(TradeOrder.class)
    .process(exchange -> {
        TradeOrder order = exchange.getIn().getBody(TradeOrder.class);
        List<String> steps = new ArrayList<>();
        steps.add("direct:pre-trade-compliance");
        steps.add("direct:venue-" + selectVenue(order));
        steps.add("direct:post-trade-reporting");
        exchange.getIn().setHeader("executionSlip", String.join(",", steps));
    })
    .routingSlip(header("executionSlip"));
```

**Pattern: Routing Slip.** The execution route is assembled dynamically: compliance check → venue-specific execution → reporting. Each step in the slip can short-circuit the rest (compliance failure stops execution).

## Pattern 6: Event-Driven Consumer — Position updates

Maintain real-time portfolio positions from trade executions:

```java
from("kafka:bond.trades.executed?brokers=localhost:9092&groupId=position-tracker")
    .routeId("position-tracker")
    .unmarshal().json(TradeExecution.class)
    .filter(simple("${body.status} == 'FILLED' || ${body.status} == 'PARTIAL'"))
    .process(exchange -> {
        TradeExecution trade = exchange.getIn().getBody(TradeExecution.class);
        int signedQuantity = "BUY".equals(trade.side()) ? trade.quantity() : -trade.quantity();
        Map<String, Object> positionUpdate = Map.of(
            "portfolio_id", trade.portfolioId(),
            "isin", trade.isin(),
            "quantity_change", signedQuantity,
            "executed_price", trade.executedPrice(),
            "cost_change", signedQuantity * trade.executedPrice(),
            "execution_id", trade.executionId(),
            "timestamp", trade.executedAt()
        );
        exchange.getIn().setBody(positionUpdate);
    })
    .setHeader(KafkaConstants.KEY, simple("${body[portfolio_id]}"))
    .marshal().json()
    .to("kafka:bond.positions.updates?brokers=localhost:9092");
```

**Pattern: Event-Driven Consumer.** The position tracker reacts to trade execution events. Kafka's partition-by-portfolio-ID guarantees that all trades for a portfolio are processed in order by the same consumer — critical for accurate position calculation.

## Pattern 7: Wire Tap — Audit trail

Every trade order and execution gets Wire Tapped to an audit log:

```java
from("kafka:bond.orders.validated?brokers=localhost:9092&groupId=audit-tap")
    .routeId("trade-audit-wire-tap")
    .wireTap("direct:audit-log")
    .to("direct:continue-processing");

from("direct:audit-log")
    .routeId("audit-logger")
    .process(exchange -> {
        Map<String, Object> auditEntry = Map.of(
            "event_type", "TRADE_ORDER",
            "timestamp", System.currentTimeMillis(),
            "payload", exchange.getIn().getBody(String.class),
            "source_route", exchange.getFromRouteId(),
            "exchange_id", exchange.getExchangeId()
        );
        exchange.getIn().setBody(auditEntry);
    })
    .marshal().json()
    .to("kafka:bond.audit.log?brokers=localhost:9092");
```

**Pattern: Wire Tap.** The Wire Tap sends a copy of every validated trade to the audit topic without affecting the main processing flow. This is non-negotiable in financial systems — every order must be logged for regulatory compliance.

## Pattern inventory

| Pattern | Where |
|---------|-------|
| **Channel Adapter** | Bloomberg, Reuters, Exchange feed ingestion |
| **Message Translator** | Source-specific → canonical price format |
| **Normalizer** | Best-price aggregation from multiple feeds |
| **Aggregator** | Time-windowed price consolidation |
| **Publish-Subscribe** | Multicast to all desk filters |
| **Message Filter** | Per-desk subscription criteria |
| **Selective Consumer** | Desk-specific price topics |
| **Idempotent Receiver** | Duplicate order rejection |
| **Content Enricher** | Order enrichment with current market price |
| **Content-Based Router** | Validation decisions (accept, reject, hold) |
| **Routing Slip** | Dynamic trade execution path |
| **Event-Driven Consumer** | Position tracking from trade events |
| **Wire Tap** | Audit trail for compliance |
| **Correlation Identifier** | ISIN for prices, order ID for trades |
| **Canonical Data Model** | `CanonicalPrice` as the system-wide price format |
| **Guaranteed Delivery** | Kafka's durability for every trade message |

## Mapping to the shipping domain

| Bond Trading | Shipping Domain |
|-------------|-----------------|
| Market data from multiple feeds | Tracking updates from multiple carriers |
| Normalize to canonical price | Normalize to canonical tracking event |
| Filter prices by desk subscription | Filter events by customer / SLA tier |
| Validate trade order | Validate shipping label request |
| Route to execution venue | Route to carrier API |
| Position updates from trades | Inventory updates from shipments |
| Audit trail (regulatory) | Audit trail (customs / compliance) |

The core lesson: **the patterns are the same regardless of domain.** A bond trading platform and a shipping platform face identical integration challenges — multiple data sources, normalization, routing, enrichment, validation, execution, and audit. The patterns provide the vocabulary; Camel provides the implementation.

## Comparison: Loan Broker vs. Bond Trading

| Aspect | Loan Broker | Bond Trading |
|--------|------------|--------------|
| **Primary pattern** | Scatter-Gather | Pub-Sub + Filter |
| **Data flow** | Request-Reply (one-shot) | Continuous streaming |
| **Aggregation** | Wait for all replies | Time-windowed (500ms) |
| **Correlation** | Request ID | ISIN (prices), Order ID (trades) |
| **Time model** | Bounded (15s timeout) | Unbounded (continuous feed) |
| **Error handling** | Partial results OK | Stale data rejection |
| **Key challenge** | Fan-out + collect | Normalize + distribute |

Two case studies, two different shapes of the same patterns — proving that EIP is a universal integration language.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Camel `multicast().parallelProcessing()` fans out to multiple endpoints; `aggregate()` with `completionInterval()` creates time-windowed aggregation; `idempotentConsumer()` with `MemoryIdempotentRepository` deduplicates by key; `routingSlip()` accepts a comma-separated header; `wireTap()` sends a copy without blocking the main flow; Kafka partition-by-key guarantees ordering within a partition.*
