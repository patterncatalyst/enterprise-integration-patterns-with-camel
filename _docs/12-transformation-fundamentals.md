---
title: "Transformation Fundamentals"
order: 12
part: message-transformation
description: "Message Translator, Envelope Wrapper, Content Enricher, and Content Filter — patterns that change what's inside a message."
duration: "40 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/12-transformation/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/12-transformation) with Quarkus and Spring Boot subdirectories.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/12-transformation/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/12-transformation/spring-boot
mvn spring-boot:run
```

Messages rarely arrive in exactly the format the receiver needs. An external partner sends XML; your services expect JSON. Kafka events carry order IDs but not customer names — you need to look up the name before sending a notification. An audit log needs the full order, but a summary report needs only the total and status. Messages need to be translated, enriched, stripped down, wrapped, and unwrapped as they flow between systems.

{% include excalidraw.html file="12-transformation-flow" alt="Message transformation pipeline" caption="Figure 12.1 — A transformation pipeline: translate, enrich from external data, filter out PII, produce canonical output." %}

This chapter covers four patterns that change a message's content. The next chapter covers structural transformation: how to combine multiple messages into one (Aggregator), normalize different formats into a canonical form (Normalizer), and what to do when systems can't change (Anti-Corruption Layer).

## Pattern: Message Translator

### The problem

The partner order management system sends orders as XML:

But the shipping domain's internal services expect JSON events:

```json
{
  "order_id": 42,
  "customer_id": "CUST-100",
  "item_sku": "SKU-ABC-42",
  "quantity": 2,
  "amount": 149.98
}
```

The field names are different (`orderId` vs `order_id`), the structure is different (nested `lineItems` vs flat), and the format is different (XML vs JSON). Something needs to translate.

### The solution

A **Message Translator** transforms a message from one format/schema to another. It's the most common transformation pattern — almost every integration involves at least one translation. The translator can operate at three levels:

1. **Format translation** — XML to JSON, CSV to JSON, Avro to JSON.
2. **Schema translation** — Different field names, different nesting, different data types.
3. **Semantic translation** — Different meanings (currency codes, status enums, date formats).

### How Camel models it

The route logic is identical across runtimes — only the class annotations differ:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
// Quarkus — CDI discovers the route via @ApplicationScoped
@ApplicationScoped
public class MessageTranslatorRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.external?brokers={{kafka.brokers}}&groupId=translator-demo")
            .routeId("message-translator")
            // translation logic below...
    }
}
```

```java
// Spring Boot — Spring discovers the route via @Component
@Component
public class MessageTranslatorRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.external?brokers={{kafka.brokers}}&groupId=translator-demo")
            .routeId("message-translator")
            // translation logic below...
    }
}
```

Camel provides multiple approaches to message translation:

**Data format marshaling/unmarshaling** for format translation:

```java
// Simple format translation: XML → JSON
from("file:data/incoming?include=.*\\.xml&move=.done")
    .routeId("translator-format")
    .unmarshal().jacksonXml(Map.class)
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");

// Schema translation: partner format → internal format
from("kafka:eip.partners.orders?brokers=localhost:9092&groupId=translator")
    .routeId("translator-schema")
    .unmarshal().jacksonXml(Map.class)
    .process(exchange -> {
        Map<String, Object> partner = exchange.getIn().getBody(Map.class);
        Map<String, Object> internal = new java.util.LinkedHashMap<>();
        internal.put("order_id", partner.get("orderId"));
        internal.put("customer_id", partner.get("customerRef"));
        // Flatten line items and compute total
        List<Map<String, Object>> items = (List<Map<String, Object>>) partner.get("lineItems");
        if (items != null && !items.isEmpty()) {
            Map<String, Object> firstItem = items.get(0);
            internal.put("item_sku", firstItem.get("sku"));
            int qty = Integer.parseInt(String.valueOf(firstItem.get("qty")));
            double price = Double.parseDouble(String.valueOf(firstItem.get("unitPrice")));
            internal.put("quantity", qty);
            internal.put("amount", qty * price);
        }
        exchange.getIn().setBody(internal);
    })
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");

// Using JOLT for declarative JSON-to-JSON transformation
from("kafka:eip.partners.json-orders?brokers=localhost:9092&groupId=jolt-translator")
    .routeId("translator-jolt")
    .unmarshal().json(Map.class)
    .to("jolt:specs/partner-to-internal.json?inputType=JsonString&outputType=JsonString")
    .to("kafka:eip.orders.placed?brokers=localhost:9092");
```

### Translation approaches in Camel

| Approach | When to use |
|----------|-------------|
| `marshal()`/`unmarshal()` | Pure format conversion (XML ↔ JSON ↔ CSV ↔ Avro) |
| `process()` with Java code | Complex schema mapping with business logic |
| JOLT (`jolt:`) | Declarative JSON-to-JSON transformation (no code) |
| XSLT (`xslt:`) | XML-to-XML transformation (when XML is unavoidable) |
| JSONata (`jsonata:`) | Concise JSON query and transformation |
| Bean method | Reusable, testable translation in a CDI bean |

For our shipping domain, most translations happen in `process()` blocks because they involve domain logic (computing totals, validating references, mapping status codes). For simple format conversions, `marshal()`/`unmarshal()` is sufficient.

## Pattern: Envelope Wrapper

### The problem

When order-service publishes an `OrderPlaced` event, it includes metadata: the event type, a unique ID, a timestamp, the source service. This metadata isn't part of the order itself — it's an *envelope* around the order payload. On the receiving side, the consumer needs to strip the envelope to get the order data, process it, and then wrap the result in a new envelope for the next event.

Similarly, SOAP services wrap payloads in a SOAP envelope with headers, namespaces, and security tokens. Avro messages wrap the payload with a schema ID. HTTP responses wrap the body with status codes and headers.

### The solution

An **Envelope Wrapper** adds (wraps) or removes (unwraps) a layer of metadata around the core message payload. The wrapper carries context — routing information, security tokens, schema identifiers, timestamps — that the messaging infrastructure needs but the business logic doesn't.

### How Camel models it

```java
// Wrapping: add an event envelope before publishing
from("direct:wrap-order-event")
    .routeId("envelope-wrapper-wrap")
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        Map<String, Object> envelope = new java.util.LinkedHashMap<>();
        envelope.put("event_type", "OrderPlaced");
        envelope.put("event_id", java.util.UUID.randomUUID().toString());
        envelope.put("event_time", java.time.Instant.now().toString());
        envelope.put("source", "order-service");
        envelope.put("schema_version", "v1");
        envelope.put("data", order);
        exchange.getIn().setBody(envelope);
    })
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");

// Unwrapping: extract the payload from the envelope
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("envelope-wrapper-unwrap")
    .unmarshal().json(Map.class)
    .log("Event: ${body[event_type]} from ${body[source]} at ${body[event_time]}")
    // Preserve envelope metadata in headers
    .setHeader("eventType", simple("${body[event_type]}"))
    .setHeader("eventId", simple("${body[event_id]}"))
    .setHeader("eventTime", simple("${body[event_time]}"))
    .setHeader("eventSource", simple("${body[source]}"))
    // Unwrap: set body to just the payload
    .setBody(simple("${body[data]}"))
    .log("Processing order: ${body[order_id]}")
    .to("direct:check-inventory");
```

### Envelope design in the shipping domain

Our event envelope from Chapter 07 is a deliberate design choice:

```json
{
  "event_type": "OrderPlaced",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_time": "2026-07-10T14:30:00Z",
  "source": "order-service",
  "schema_version": "v1",
  "data": { ... }
}
```

The envelope fields serve specific purposes:
- `event_type` — Format indicator (Chapter 08) and routing key.
- `event_id` — Correlation identifier and deduplication key.
- `event_time` — Business timestamp for ordering and TTL checks.
- `source` — Provenance for debugging and auditing.
- `schema_version` — Enables schema evolution without breaking consumers.
- `data` — The actual payload that the business logic processes.

When consuming, unwrap early (extract `data` into the body, move metadata to headers) so business logic never needs to know about the envelope structure.

## Pattern: Content Enricher

### The problem

When notification-service receives an `OrderPlaced` event, it needs to send the customer an email with their name, the order details, and the expected delivery date. But the event only contains `customer_id` — not the customer's name or email address. The notification-service needs to *enrich* the event with data from the customer database.

### The solution

A **Content Enricher** augments a message with data from an external source. The enricher receives a message, looks up additional data (from a database, an API, a cache, or another message), and adds that data to the message before passing it along.

Camel supports two enrichment approaches:
1. **`enrich()`** — Call an external resource and merge the result with the original message using an `AggregationStrategy`.
2. **`pollEnrich()`** — Poll a resource (like a file or a message queue) and merge the result.

### How Camel models it

```java
// Enrich the order event with customer details from the database
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=notification-enricher")
    .routeId("content-enricher")
    .unmarshal().json(Map.class)
    .log("Enriching order ${body[order_id]} with customer data")
    // Look up customer details
    .enrich("sql:SELECT name, email FROM orders.customers "
            + "WHERE customer_id = :#${body[customer_id]}"
            + "?dataSource=#orderDataSource",
        (oldExchange, newExchange) -> {
            Map<String, Object> order = oldExchange.getIn().getBody(Map.class);
            List<Map<String, Object>> rows = newExchange.getIn().getBody(List.class);
            if (rows != null && !rows.isEmpty()) {
                order.put("customer_name", rows.get(0).get("name"));
                order.put("customer_email", rows.get(0).get("email"));
            }
            oldExchange.getIn().setBody(order);
            return oldExchange;
        })
    // Enrich with estimated delivery from shipping calculator
    .enrich("http://shipping-calc.example.com/estimate"
            + "?httpMethod=POST&connectTimeout=5000",
        (oldExchange, newExchange) -> {
            Map<String, Object> order = oldExchange.getIn().getBody(Map.class);
            Map<String, Object> estimate = newExchange.getIn().getBody(Map.class);
            order.put("estimated_delivery", estimate.get("delivery_date"));
            order.put("shipping_cost", estimate.get("cost"));
            oldExchange.getIn().setBody(order);
            return oldExchange;
        })
    .log("Enriched order ${body[order_id]} for ${body[customer_name]}")
    .to("direct:send-order-confirmation");
```

### Enrichment with Redis cache

For high-throughput enrichment, cache frequently accessed data in Redis to avoid hitting the database for every message:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=cached-enricher")
    .routeId("content-enricher-cached")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        String customerId = (String) exchange.getIn().getBody(Map.class).get("customer_id");
        exchange.getIn().setHeader("customerCacheKey", "customer:" + customerId);
    })
    // Try Redis cache first
    .enrich("redis:GET?redisClient=#redisClient&key=${header.customerCacheKey}",
        (oldExchange, newExchange) -> {
            String cached = newExchange.getIn().getBody(String.class);
            if (cached != null) {
                Map<String, Object> order = oldExchange.getIn().getBody(Map.class);
                Map<String, Object> customer = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(cached, Map.class);
                order.put("customer_name", customer.get("name"));
                order.put("customer_email", customer.get("email"));
                oldExchange.getIn().setHeader("cacheHit", true);
            }
            return oldExchange;
        })
    .choice()
        .when(header("cacheHit").isNotEqualTo(true))
            // Cache miss: fall back to database
            .enrich("sql:SELECT name, email FROM orders.customers "
                    + "WHERE customer_id = :#${body[customer_id]}"
                    + "?dataSource=#orderDataSource",
                AggregationStrategies.bean(CustomerEnricher.class, "merge"))
    .end()
    .to("direct:send-order-confirmation");
```

## Pattern: Content Filter

### The problem

The `OrderPlaced` event contains everything about the order: customer ID, item details, payment method, shipping address, and internal fields like `created_by_user_id` and `internal_notes`. But the notification to the customer should only contain: order ID, item name, quantity, total, and estimated delivery. Sending internal fields to customers is a data leak; sending unnecessary fields wastes bandwidth and increases the attack surface.

### The solution

A **Content Filter** removes unwanted fields from a message, keeping only what the receiver needs. It's the opposite of a Content Enricher — instead of adding data, it strips data.

Content filters are essential for:
- **Security** — Remove internal fields before sending to external systems.
- **Privacy** — Strip PII before sending to analytics or logging systems.
- **Efficiency** — Reduce message size when downstream consumers don't need all fields.
- **Compatibility** — Remove fields that an older consumer doesn't understand.

### How Camel models it

```java
// Strip internal fields before sending customer notification
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=notification-filter")
    .routeId("content-filter")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        // Keep only customer-facing fields
        Map<String, Object> filtered = new java.util.LinkedHashMap<>();
        filtered.put("order_id", order.get("order_id"));
        filtered.put("item_name", order.get("item_name"));
        filtered.put("quantity", order.get("quantity"));
        filtered.put("amount", order.get("amount"));
        filtered.put("status", order.get("status"));
        // Explicitly exclude: customer_id, payment_card, internal_notes,
        // created_by_user_id, profit_margin, supplier_cost
        exchange.getIn().setBody(filtered);
    })
    .marshal().json()
    .to("direct:send-customer-notification");

// Strip PII before sending to analytics
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=analytics-pii-filter")
    .routeId("content-filter-pii")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        // Remove PII fields
        order.remove("customer_email");
        order.remove("customer_name");
        order.remove("shipping_address");
        order.remove("payment_card");
        order.remove("phone_number");
        // Replace customer_id with a hash for correlation without identification
        String customerId = (String) order.get("customer_id");
        if (customerId != null) {
            order.put("customer_hash",
                Integer.toHexString(customerId.hashCode()));
            order.remove("customer_id");
        }
        exchange.getIn().setBody(order);
    })
    .marshal().json()
    .to("kafka:eip.analytics.orders?brokers=localhost:9092");
```

### Allowlist vs. blocklist

The customer notification filter uses an **allowlist** (keep only these fields). The PII filter uses a **blocklist** (remove these fields). Both are valid, but they have different safety properties:

- **Allowlist** (safer) — Only specified fields pass. New fields added to the source are automatically excluded. Use when security matters — you can't accidentally leak a field you forgot to block.
- **Blocklist** (more flexible) — Specified fields are removed; everything else passes. New fields added to the source automatically pass through. Use when you want most fields and only need to exclude specific ones.

For external-facing outputs and PII-sensitive contexts, prefer allowlists.

## Common pitfalls

**Translators that lose data.** If you translate from a rich format to a simpler one (XML with attributes → flat JSON), make sure you're not silently dropping data. Log a warning if fields are present in the source but have no mapping in the target.

**Enrichers that block on slow lookups.** A database lookup per message works at 10 messages/second. At 10,000 messages/second, it becomes a bottleneck. Use caching (Redis), batching, or async lookups for high-throughput enrichment.

**Content filters that become stale.** If you add a new PII field (like `social_security_number`) to the order schema but forget to update the PII filter, it passes through to analytics. Pair content filters with schema registry checks — when the schema evolves, validate that the filter still covers all sensitive fields.

**Envelope assumptions across services.** If the envelope format changes (adding a new metadata field, changing the version scheme), every wrapper/unwrapper needs to update. Publish the envelope schema in the registry and version it. Treat the envelope as a first-class schema, not an afterthought.

## Runtime configuration

The transformation patterns above use the same Camel Java DSL on both Quarkus and Spring Boot. The differences are in project setup and configuration:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties
quarkus.application.name=eip-transformation
kafka.brokers=localhost:9092
quarkus.redis.hosts=redis://localhost:6379
quarkus.http.port=8082
quarkus.kafka.devservices.enabled=false
quarkus.log.category."org.apache.camel".level=INFO
```

```properties
# Spring Boot — application.properties
spring.application.name=eip-transformation
kafka.brokers=localhost:9092
spring.data.redis.host=localhost
spring.data.redis.port=6379
server.port=8082
logging.level.org.apache.camel=INFO
```

The `kafka.brokers` property placeholder is shared — both runtimes resolve `{% raw %}{{kafka.brokers}}{% endraw %}` from the same key. The Redis configuration differs: Quarkus uses `quarkus.redis.hosts` (full URL), while Spring Boot uses `spring.data.redis.host` and `spring.data.redis.port`.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 8: "Message Transformation"
- [enterpriseintegrationpatterns.com — Message Translator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageTranslator.html)
- [enterpriseintegrationpatterns.com — Envelope Wrapper](https://www.enterpriseintegrationpatterns.com/patterns/messaging/EnvelopeWrapper.html)
- [enterpriseintegrationpatterns.com — Content Enricher](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DataEnricher.html)
- [enterpriseintegrationpatterns.com — Content Filter](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ContentFilter.html)
- [Apache Camel — Data Formats](https://camel.apache.org/manual/data-format.html)
- [Apache Camel — Content Enricher](https://camel.apache.org/components/4.20.x/eips/content-enricher.html)

## What you learned

- **Message Translator** converts between formats and schemas — Camel supports marshal/unmarshal, processor-based mapping, JOLT, XSLT, and bean methods.
- **Envelope Wrapper** adds or removes metadata layers around the core payload — wrap on publish, unwrap on consume, preserve metadata in headers.
- **Content Enricher** augments messages with data from external sources — use `enrich()` for synchronous lookups, cache for high-throughput scenarios.
- **Content Filter** strips unwanted fields — use allowlists for security-sensitive outputs, blocklists for broad pass-through with specific exclusions.

Next: structural transformation — Aggregator, Normalizer, and Canonical Data Model.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
