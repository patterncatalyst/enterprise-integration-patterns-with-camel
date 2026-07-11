---
title: "Structural Transformation"
order: 13
part: message-transformation
description: "Aggregator, Normalizer, and Canonical Data Model — patterns that reshape, unify, and standardize messages across system boundaries."
duration: "40 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/13-aggregator/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/13-aggregator) — run it with `mvn quarkus:dev` against the local stack.

The previous chapter transformed individual messages — translating formats, enriching content, filtering fields. This chapter tackles structural transformation: combining multiple messages into one, normalizing different formats into a single canonical form, and establishing a shared data model across services.

{% include excalidraw.html file="13-aggregator" alt="Aggregator pattern" caption="Figure 13.1 — The Aggregator collects correlated messages and emits a single combined result." %}

## Pattern: Aggregator

### The problem

In Chapter 09, the Splitter broke a bulk order into individual line items. Each item was processed independently — inventory checked, price calculated, warehouse assigned. Now the results need to be reassembled into a single order response. Customer-service can't send 50 separate "your item shipped" emails — it needs one email with all 50 items.

More broadly: events from different services about the same order need to be correlated and combined. `InventoryReserved`, `PaymentProcessed`, and `ShipmentScheduled` are three separate events that together represent a complete order lifecycle. An order status dashboard needs all three to show the full picture.

### The solution

An **Aggregator** collects related messages (by a correlation key) and combines them into a single message. It needs to answer three questions:

1. **Which messages belong together?** — The correlation expression (e.g., order ID).
2. **How are they combined?** — The aggregation strategy (merge, collect, compute).
3. **When is the aggregation complete?** — The completion condition (count, timeout, predicate).

### How Camel models it

Camel's `aggregate()` EIP is one of the most powerful and configurable patterns in the framework:

```java
// Aggregate order lifecycle events into a complete status
from("kafka:eip.orders.status-updates?brokers=localhost:9092&groupId=order-aggregator")
    .routeId("aggregator")
    .unmarshal().json(Map.class)
    .aggregate(simple("${body[order_id]}"), new OrderLifecycleAggregation())
        .completionPredicate(simple("${body[stages_complete]} == true"))
        .completionTimeout(300000) // 5 minute timeout
        .aggregationRepository(new MemoryAggregationRepository())
    .log("Order ${body[order_id]} fully aggregated: ${body[stages]}")
    .to("direct:update-order-status");

// Aggregation strategy: merge lifecycle stages
public class OrderLifecycleAggregation implements AggregationStrategy {
    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        Map<String, Object> incoming = newExchange.getIn().getBody(Map.class);
        if (oldExchange == null) {
            Map<String, Object> aggregated = new java.util.LinkedHashMap<>();
            aggregated.put("order_id", incoming.get("order_id"));
            aggregated.put("stages", new java.util.LinkedHashMap<>());
            addStage(aggregated, incoming);
            newExchange.getIn().setBody(aggregated);
            return newExchange;
        }
        Map<String, Object> aggregated = oldExchange.getIn().getBody(Map.class);
        addStage(aggregated, incoming);
        return oldExchange;
    }

    private void addStage(Map<String, Object> aggregated, Map<String, Object> event) {
        Map<String, Object> stages = (Map<String, Object>) aggregated.get("stages");
        stages.put((String) event.get("event_type"), event);
        // Check if all required stages are present
        boolean complete = stages.containsKey("InventoryReserved")
            && stages.containsKey("PaymentProcessed")
            && stages.containsKey("ShipmentScheduled");
        aggregated.put("stages_complete", complete);
    }
}
```

### Completion conditions

The aggregator must know when to emit the aggregated result. Camel supports multiple completion conditions that can be combined:

| Condition | Description | Use case |
|-----------|-------------|----------|
| `completionSize(N)` | Emit after N messages are collected | Known number of parts (split/aggregate) |
| `completionTimeout(ms)` | Emit if no new message arrives within the timeout | Unknown number of parts, deadline |
| `completionInterval(ms)` | Emit on a fixed schedule regardless of message count | Periodic batching |
| `completionPredicate(expr)` | Emit when a condition is true | All required stages complete |
| `forceCompletionOnStop()` | Emit incomplete aggregations when the route stops | Graceful shutdown |

Conditions can be combined with OR semantics — whichever fires first triggers emission. The order lifecycle aggregator above uses both a predicate (all stages present) and a timeout (5 minutes) as a safety net.

### Persistent aggregation

The in-memory `MemoryAggregationRepository` works for development but loses state on restart. For production, use a persistent repository:

```java
// JDBC-backed aggregation repository
@Produces
@Named("jdbcRepo")
public JdbcAggregationRepository aggregationRepo(@Named("orderDataSource") DataSource ds) {
    JdbcAggregationRepository repo = new JdbcAggregationRepository();
    repo.setDataSource(ds);
    repo.setRepositoryName("camel_aggregation");
    repo.setStoreBodyAsText(true);
    return repo;
}

// Use in route
.aggregate(simple("${body[order_id]}"), strategy)
    .aggregationRepository("#jdbcRepo")
    .completionTimeout(300000)
```

This ensures that if the service restarts mid-aggregation, in-flight aggregations resume from the database.

## Pattern: Normalizer

### The problem

The shipping domain receives orders from multiple sources:
- The web app sends JSON.
- The mobile app sends a slightly different JSON schema (camelCase vs snake_case, different field names).
- Partner integrations send XML.
- The legacy system sends CSV files.

Each source has a different format, but the downstream processing should be identical regardless of the source. Writing separate processing logic for each format is wasteful and error-prone.

### The solution

A **Normalizer** detects the incoming message format and translates it into a single canonical form. It combines a content-based router (to detect the format) with message translators (to convert each format). After normalization, all downstream routes receive messages in the same canonical format, regardless of the original source.

### How Camel models it

```java
// Normalizer: detect format, translate to canonical form
from("kafka:eip.orders.raw?brokers=localhost:9092&groupId=normalizer")
    .routeId("normalizer")
    .choice()
        // Detect format from the contentType header
        .when(header("contentType").isEqualTo("application/xml"))
            .unmarshal().jacksonXml(Map.class)
            .to("direct:translate-xml-order")
        .when(header("contentType").isEqualTo("text/csv"))
            .unmarshal().csv()
            .to("direct:translate-csv-order")
        .when(header("source").isEqualTo("mobile-app"))
            .unmarshal().json(Map.class)
            .to("direct:translate-mobile-order")
        .otherwise()
            // Default: assume standard JSON
            .unmarshal().json(Map.class)
    .end()
    // After normalization, all orders are in canonical form
    .to("direct:process-normalized-order");

// Translate mobile format (camelCase) to canonical (snake_case)
from("direct:translate-mobile-order")
    .routeId("normalizer-mobile")
    .process(exchange -> {
        Map<String, Object> mobile = exchange.getIn().getBody(Map.class);
        Map<String, Object> canonical = new java.util.LinkedHashMap<>();
        canonical.put("order_id", mobile.get("orderId"));
        canonical.put("customer_id", mobile.get("customerId"));
        canonical.put("item_sku", mobile.get("itemSku"));
        canonical.put("quantity", mobile.get("qty"));
        canonical.put("amount", mobile.get("totalAmount"));
        canonical.put("destination_country", mobile.get("shipTo"));
        exchange.getIn().setBody(canonical);
    });

// Translate XML partner format to canonical
from("direct:translate-xml-order")
    .routeId("normalizer-xml")
    .process(exchange -> {
        Map<String, Object> xml = exchange.getIn().getBody(Map.class);
        Map<String, Object> canonical = new java.util.LinkedHashMap<>();
        canonical.put("order_id", xml.get("orderId"));
        canonical.put("customer_id", xml.get("customerRef"));
        canonical.put("item_sku", xml.get("productCode"));
        canonical.put("quantity", xml.get("quantity"));
        canonical.put("amount", xml.get("totalValue"));
        canonical.put("destination_country", xml.get("destinationCountry"));
        exchange.getIn().setBody(canonical);
    });
```

## Pattern: Canonical Data Model

### The problem

The normalizer translates each source format into a canonical form. But what *is* that canonical form? Without an explicit, shared data model, each translator makes its own assumptions about field names, types, optionality, and semantics. Over time, the "canonical" form drifts as different developers add different fields.

### The solution

A **Canonical Data Model** is a formally defined, shared schema that all services agree on. It's the lingua franca of the integration platform. Every message that flows between services conforms to this model — regardless of what the original source used.

In our shipping domain, the canonical model is defined as Avro schemas in the Apicurio Registry:

```json
{
  "type": "record",
  "name": "OrderPlaced",
  "namespace": "eip.order.v1",
  "fields": [
    {"name": "order_id", "type": "long"},
    {"name": "customer_id", "type": "string"},
    {"name": "item_sku", "type": "string"},
    {"name": "quantity", "type": "int"},
    {"name": "amount", "type": {"type": "bytes", "logicalType": "decimal", "precision": 10, "scale": 2}},
    {"name": "currency", "type": "string", "default": "USD"},
    {"name": "destination_country", "type": "string"},
    {"name": "shipping_priority", "type": {"type": "enum", "name": "Priority", "symbols": ["STANDARD", "EXPRESS"]}},
    {"name": "contains_hazmat", "type": "boolean", "default": false},
    {"name": "created_at", "type": {"type": "long", "logicalType": "timestamp-millis"}}
  ]
}
```

### How it works with Camel and Apicurio

```java
// Producer: serialize to the canonical Avro schema
from("direct:publish-canonical-order")
    .routeId("canonical-producer")
    .marshal().avro("eip.order.v1.OrderPlaced")
    .to("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&valueSerializer=io.apicurio.registry.serde.avro.AvroKafkaSerializer"
        + "&additionalProperties.apicurio.registry.url=http://localhost:8080/apis/registry/v2");

// Consumer: deserialize from the canonical schema
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=canonical-consumer"
        + "&valueDeserializer=io.apicurio.registry.serde.avro.AvroKafkaDeserializer"
        + "&additionalProperties.apicurio.registry.url=http://localhost:8080/apis/registry/v2")
    .routeId("canonical-consumer")
    .log("Canonical order: ${body}")
    .to("direct:process-order");
```

### Benefits of a canonical data model

1. **N→1 instead of N→N translations.** Without a canonical model, translating between N systems requires N×(N-1) translators. With a canonical model, each system needs one translator (to/from canonical) — that's 2N translators. For 5 systems: 20 vs 10 translators.

2. **Schema evolution is governed.** Apicurio's compatibility modes ensure that schema changes don't break consumers. Backward compatibility means new fields can be added with defaults, but existing fields can't be removed.

3. **Contract testing.** The canonical schema is a testable contract. Producers can validate that their output conforms; consumers can validate that their input handler covers all required fields.

4. **Documentation.** The schema *is* the documentation. Field names, types, defaults, and enums are machine-readable and always up to date.

### The cost of a canonical model

A canonical model adds a translation layer at every system boundary. If two services could communicate directly with minimal translation (they both use the same JSON structure), forcing them through a canonical Avro model adds serialization overhead and complexity. The canonical model pays off when you have 5+ systems or when schema governance is critical. For a small system with 2-3 services, direct translation may be simpler.

## Common pitfalls

**Aggregators without timeout.** If the expected completion condition is never met (a message is lost, a service fails to emit an event), the aggregation hangs forever. Always set a `completionTimeout` as a safety net.

**Aggregators with in-memory state.** The default `MemoryAggregationRepository` loses state on restart. Use JDBC, Infinispan, or Redis-backed repositories for production.

**Normalizers that grow unbounded.** Each new source format adds a branch to the normalizer's router and a new translator. Eventually, the normalizer becomes a monolith. Consider splitting normalizers by source domain (one for partner integrations, one for internal apps) rather than one giant normalizer.

**Canonical models that become kitchen sinks.** The canonical model should represent the *domain*, not every field that any source or consumer has ever needed. Resist the urge to add every partner-specific field to the canonical model — use enrichment or extension fields instead.

**Over-aggregating.** Not every related message needs to be aggregated. If downstream consumers can handle individual events (with proper correlation), aggregation adds unnecessary latency and state management complexity. Only aggregate when the consumer genuinely needs the combined view.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 8: "Message Transformation"
- [enterpriseintegrationpatterns.com — Aggregator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Aggregator.html)
- [enterpriseintegrationpatterns.com — Normalizer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Normalizer.html)
- [enterpriseintegrationpatterns.com — Canonical Data Model](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CanonicalDataModel.html)
- [Apache Camel — Aggregate EIP](https://camel.apache.org/components/4.20.x/eips/aggregate-eip.html)
- [Apicurio Registry — Schema Compatibility](https://www.apicur.io/registry/)

## What you learned

- **Aggregator** collects related messages by a correlation key and combines them — use completion conditions (size, timeout, predicate) to control when aggregated results are emitted.
- **Normalizer** detects incoming format and translates to a canonical form — a content-based router feeding format-specific translators.
- **Canonical Data Model** establishes a shared schema (Avro + Apicurio) that all services conform to — reduces N×N translations to 2N and enables governed schema evolution.

This completes Part 6 — Message Transformation (7 patterns across 2 chapters). Next: Part 7 — Messaging Endpoints, where we explore the patterns that connect application code to the messaging system.

---

*Verification status: verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11).*
