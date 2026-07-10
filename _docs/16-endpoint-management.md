---
title: "Endpoint Management"
order: 16
part: messaging-endpoints
description: "Messaging Gateway, Selective Consumer, Channel Purger, and Messaging Mapper — patterns for managing the boundary between application code and the messaging system."
duration: "35 minutes"
---

The previous two chapters covered how consumers receive and producers send messages. This chapter completes the Messaging Endpoints catalog with four patterns that manage the boundary layer itself: abstracting messaging behind a gateway, selectively consuming from shared channels, purging stale messages, and mapping between domain objects and messages.

## Pattern: Messaging Gateway

### The problem

Throughout the previous chapters, Camel routes directly reference messaging infrastructure: Kafka topic names, broker addresses, serialization details. If the business logic in a CDI bean needs to publish an event, it would have to inject a `ProducerTemplate` and construct the correct endpoint URI — coupling the bean to Camel's API and the infrastructure topology.

### The solution

A **Messaging Gateway** hides the messaging system behind a domain-specific interface. Application code calls `orderGateway.publishOrderPlaced(order)` instead of `producerTemplate.sendBody("kafka:eip.orders.placed?brokers=...", order)`. The gateway encapsulates endpoint URIs, serialization, header setup, and error handling.

### How Camel models it

Camel's `ProducerTemplate` and `FluentProducerTemplate` are the building blocks. Wrap them in a CDI bean that exposes domain methods:

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

```java
// The Messaging Gateway: domain-specific interface over messaging
@ApplicationScoped
@Named("orderGateway")
public class OrderMessagingGateway {

    @Inject
    FluentProducerTemplate producer;

    public void publishOrderPlaced(Map<String, Object> order) {
        String eventId = java.util.UUID.randomUUID().toString();
        producer.to("direct:publish-order-placed")
            .withHeader("eventId", eventId)
            .withHeader("eventType", "OrderPlaced")
            .withHeader("orderId", order.get("order_id"))
            .withBody(order)
            .send();
    }

    public Map<String, Object> requestInventoryCheck(Map<String, Object> order) {
        return producer.to("direct:check-inventory")
            .withBody(order)
            .request(Map.class);
    }

    public void publishPaymentProcessed(String orderId, double amount) {
        Map<String, Object> event = new java.util.LinkedHashMap<>();
        event.put("order_id", orderId);
        event.put("amount", amount);
        event.put("status", "PROCESSED");
        producer.to("direct:publish-payment-processed")
            .withHeader("orderId", orderId)
            .withBody(event)
            .send();
    }
}

// The routes that the gateway calls — these handle the messaging details
from("direct:publish-order-placed")
    .routeId("gateway-publish-order")
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&key=${header.orderId}"
        + "&requestRequiredAcks=all");

from("direct:publish-payment-processed")
    .routeId("gateway-publish-payment")
    .marshal().json()
    .to("kafka:eip.payments.processed?brokers=localhost:9092"
        + "&key=${header.orderId}");
```

```yaml
# Routes behind the gateway
- route:
    id: gateway-publish-order
    from:
      uri: "direct:publish-order-placed"
    steps:
      - marshal:
          json: {}
      - to:
          uri: "kafka:eip.orders.placed"
          parameters:
            brokers: "localhost:9092"
            key: "${header.orderId}"
            requestRequiredAcks: "all"

- route:
    id: gateway-publish-payment
    from:
      uri: "direct:publish-payment-processed"
    steps:
      - marshal:
          json: {}
      - to:
          uri: "kafka:eip.payments.processed"
          parameters:
            brokers: "localhost:9092"
            key: "${header.orderId}"
```

```xml
<route id="gateway-publish-order">
  <from uri="direct:publish-order-placed"/>
  <marshal><json/></marshal>
  <to uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;key=${header.orderId}&amp;requestRequiredAcks=all"/>
</route>

<route id="gateway-publish-payment">
  <from uri="direct:publish-payment-processed"/>
  <marshal><json/></marshal>
  <to uri="kafka:eip.payments.processed?brokers=localhost:9092&amp;key=${header.orderId}"/>
</route>
```

### Benefits

- **Testability** — Mock `OrderMessagingGateway` in unit tests. No need to start Kafka.
- **Encapsulation** — Topic names, serialization, and header conventions are in one place.
- **Refactoring** — Switch from Kafka to Pulsar by changing the gateway's routes, not every caller.
- **Type safety** — The gateway can accept domain objects instead of generic maps.

## Pattern: Selective Consumer

### The problem

The `eip.orders.placed` topic contains all orders. But the hazmat handling service only cares about orders that contain hazardous materials. It doesn't want to process (or even deserialize) the other 95% of orders.

A message filter (Chapter 09) works, but it deserializes every message just to check the `contains_hazmat` field. For high-volume topics, this is wasteful.

### The solution

A **Selective Consumer** filters messages *at the transport level* — before deserialization, before the message enters the application's processing pipeline. In Kafka, this can mean:

1. **Separate topics** (Datatype Channel) — Put hazmat orders on `eip.orders.hazmat`. The consumer only subscribes to what it needs.
2. **Kafka headers** — Filter by header value without deserializing the body.
3. **Partition assignment** — Route hazmat orders to a specific partition and consume only that partition.

### How Camel models it

Camel doesn't support transport-level filtering for Kafka (the Kafka client protocol doesn't support server-side filtering). But you can optimize by filtering on headers before body deserialization:

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

```java
// Selective consumer: filter on Kafka header before unmarshaling body
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=hazmat-service")
    .routeId("selective-consumer")
    // Check header BEFORE expensive unmarshal
    .filter(header("containsHazmat").isEqualTo("true"))
        .unmarshal().json(Map.class)
        .log("Processing hazmat order ${body[order_id]}")
        .to("direct:hazmat-processing")
    .end();

// Producer: set the header that enables selective consumption
from("direct:publish-order")
    .routeId("selective-producer")
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        exchange.getIn().setHeader("containsHazmat",
            String.valueOf(order.get("contains_hazmat")));
        exchange.getIn().setHeader("shippingPriority",
            String.valueOf(order.get("shipping_priority")));
        exchange.getIn().setHeader("destinationCountry",
            String.valueOf(order.get("destination_country")));
    })
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");
```

```yaml
# Selective consumer on headers
- route:
    id: selective-consumer
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "hazmat-service"
    steps:
      - filter:
          simple: "${header.containsHazmat} == 'true'"
          steps:
            - unmarshal:
                json: {}
            - log:
                message: "Processing hazmat order ${body[order_id]}"
            - to:
                uri: "direct:hazmat-processing"
```

```xml
<route id="selective-consumer">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=hazmat-service"/>
  <filter>
    <simple>${header.containsHazmat} == 'true'</simple>
    <unmarshal><json/></unmarshal>
    <log message="Processing hazmat order ${body[order_id]}"/>
    <to uri="direct:hazmat-processing"/>
  </filter>
</route>
```

### The key insight: promote filter criteria to headers

For selective consumption to be efficient, the criteria must be available *without* deserializing the body. This means the producer must set Kafka headers for fields that consumers commonly filter on. In our shipping domain:

```
Kafka Headers:
  containsHazmat: "true"
  shippingPriority: "EXPRESS"
  destinationCountry: "US"
  orderAmount: "149.99"
```

Consumers can filter on these headers cheaply. Only messages that pass the filter are fully deserialized.

## Pattern: Channel Purger

### The problem

During development and testing, Kafka topics accumulate stale messages from previous test runs. When you restart a consumer with `autoOffsetReset=earliest`, it replays hundreds of old messages, polluting logs and triggering unintended side effects.

In production, after a deployment rollback, you may need to discard messages that were produced by the buggy version — they contain malformed data that would crash consumers.

### The solution

A **Channel Purger** removes unwanted messages from a channel. In Kafka, there's no "delete message" API — but you can achieve the same effect through:

1. **Offset manipulation** — Reset the consumer group's offset to skip past the unwanted messages.
2. **Topic deletion and recreation** — Nuclear option for development environments.
3. **Record deletion** — Kafka supports deleting records before a given offset (`deleteRecords`).
4. **Purge route** — A Camel route that consumes and discards messages matching a criteria.

### How Camel and Kafka CLI model it

For development, the Kafka CLI tools or a Camel route can purge topics:

```bash
# Reset consumer group offset to latest (skip all existing messages)
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group inventory-service \
  --topic eip.orders.placed \
  --reset-offsets --to-latest --execute

# Delete all records before a specific offset
kafka-delete-records.sh --bootstrap-server localhost:9092 \
  --offset-json-file offsets.json
```

In Camel, a purge route can selectively discard messages:

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

```java
// Purge route: consume and discard messages before a cutoff time
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=purger-" + System.currentTimeMillis() // unique group to read all
        + "&autoOffsetReset=earliest")
    .routeId("channel-purger")
    .unmarshal().json(Map.class)
    .choice()
        .when(simple("${body[event_time]} < '2026-07-10T00:00:00Z'"))
            .log("Purging stale message: ${body[event_type]} from ${body[event_time]}")
            // Message is consumed and discarded
        .otherwise()
            .log("Keeping message: ${body[event_type]} from ${body[event_time]}")
            .to("kafka:eip.orders.placed.clean?brokers=localhost:9092")
    .end();
```

```yaml
- route:
    id: channel-purger
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "purger-temp"
        autoOffsetReset: earliest
    steps:
      - unmarshal:
          json: {}
      - choice:
          when:
            - simple: "${body[event_time]} < '2026-07-10T00:00:00Z'"
              steps:
                - log:
                    message: "Purging: ${body[event_type]}"
          otherwise:
            steps:
              - to:
                  uri: "kafka:eip.orders.placed.clean"
                  parameters:
                    brokers: "localhost:9092"
```

```xml
<route id="channel-purger">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=purger-temp&amp;autoOffsetReset=earliest"/>
  <unmarshal><json/></unmarshal>
  <choice>
    <when>
      <simple>${body[event_time]} &lt; '2026-07-10T00:00:00Z'</simple>
      <log message="Purging: ${body[event_type]}"/>
    </when>
    <otherwise>
      <to uri="kafka:eip.orders.placed.clean?brokers=localhost:9092"/>
    </otherwise>
  </choice>
</route>
```

## Pattern: Messaging Mapper

### The problem

The domain model uses Java objects (`Order`, `Customer`, `Payment`), but messaging uses serialized formats (JSON, Avro, byte arrays). Every time a domain object enters or exits the messaging system, someone needs to convert between the domain representation and the message representation.

### The solution

A **Messaging Mapper** handles the conversion between domain objects and messages. In Camel, this is typically handled by:

1. **Data formats** — `marshal().json()` and `unmarshal().json(Order.class)`.
2. **Type converters** — Camel's built-in type conversion system.
3. **Bean binding** — Camel automatically converts message bodies to method parameter types.

### How Camel models it

{% raw %}{% include codetabs.html langs="Java DSL|YAML DSL|XML DSL" %}{% endraw %}

```java
// Typed mapping: unmarshal directly to domain objects
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=typed-consumer")
    .routeId("messaging-mapper")
    .unmarshal().json(Order.class)  // Direct mapping to domain class
    .log("Order ${body.orderId} from ${body.customerId}")
    .bean("orderService", "processOrder")  // Bean binding handles the mapping
    .marshal().json()
    .to("kafka:eip.orders.processed?brokers=localhost:9092");

// The domain class
public class Order {
    private long orderId;
    private String customerId;
    private String itemSku;
    private int quantity;
    private BigDecimal amount;
    private String destinationCountry;
    private boolean containsHazmat;
    // getters, setters, constructor
}

// The service method — Camel maps the Order body to the parameter
@ApplicationScoped
public class OrderService {
    public OrderResult processOrder(Order order) {
        // Pure domain logic — no messaging concerns
        return new OrderResult(order.getOrderId(), "PROCESSED");
    }
}
```

```yaml
- route:
    id: messaging-mapper
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "typed-consumer"
    steps:
      - unmarshal:
          json:
            unmarshalType: "com.example.Order"
      - bean:
          ref: "#orderService"
          method: "processOrder"
      - marshal:
          json: {}
      - to:
          uri: "kafka:eip.orders.processed"
          parameters:
            brokers: "localhost:9092"
```

```xml
<route id="messaging-mapper">
  <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=typed-consumer"/>
  <unmarshal><json unmarshalType="com.example.Order"/></unmarshal>
  <bean ref="#orderService" method="processOrder"/>
  <marshal><json/></marshal>
  <to uri="kafka:eip.orders.processed?brokers=localhost:9092"/>
</route>
```

### Jackson annotations for mapping control

When the message format doesn't match the domain class exactly, Jackson annotations control the mapping:

```java
public class Order {
    @JsonProperty("order_id")
    private long orderId;

    @JsonProperty("customer_id")
    private String customerId;

    @JsonProperty("item_sku")
    private String itemSku;

    @JsonIgnore  // Don't serialize internal fields
    private String internalNotes;

    @JsonProperty("created_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private Instant createdAt;
}
```

This is the messaging mapper in action — the annotations define the mapping between the domain representation and the message representation, keeping the two cleanly separated.

## Common pitfalls

**Gateways that leak abstraction.** If the gateway method signature includes `Exchange` or `ProducerTemplate`, it's not a gateway — it's a thin wrapper. The gateway should accept and return domain objects, not messaging primitives.

**Selective consumers that still deserialize everything.** If you filter on body fields, you've already paid the deserialization cost. Promote filter-worthy fields to Kafka headers at production time.

**Purging production topics without coordination.** Resetting offsets or deleting records in production can cause consumers to skip messages or reprocess already-handled messages. Coordinate with all consumer groups before purging.

**Mapping that silently drops fields.** When using `@JsonIgnoreProperties(ignoreUnknown = true)`, new fields added by the producer are silently ignored. This is usually correct (forward compatibility), but log a warning if unexpected fields appear so you know the schema has evolved.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 9: "Messaging Endpoints"
- [enterpriseintegrationpatterns.com — Messaging Gateway](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessagingGateway.html)
- [enterpriseintegrationpatterns.com — Selective Consumer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageSelector.html)
- [enterpriseintegrationpatterns.com — Channel Purger](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ChannelPurger.html)
- [enterpriseintegrationpatterns.com — Messaging Mapper](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessagingMapper.html)
- [Apache Camel — ProducerTemplate](https://camel.apache.org/manual/producertemplate.html)
- [Apache Camel — Type Converters](https://camel.apache.org/manual/type-converter.html)

## What you learned

- **Messaging Gateway** wraps messaging behind a domain-specific interface — use `FluentProducerTemplate` in a CDI bean for clean separation.
- **Selective Consumer** filters messages before full deserialization — promote filter fields to Kafka headers for efficiency.
- **Channel Purger** removes stale messages — use offset resets for broad purges, filter routes for selective purges.
- **Messaging Mapper** converts between domain objects and messages — Camel's `unmarshal()` with typed classes and bean binding handle most cases.

This completes Part 7 — Messaging Endpoints (12 patterns across 3 chapters). Next: Part 8 — System Management, where we explore the patterns that keep a running integration system observable and maintainable.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `FluentProducerTemplate` exists in Camel 4.20 and is CDI-injectable in Quarkus; `unmarshal().json(Order.class)` unmarshals to a typed class; `toD()` resolves dynamic URIs; Kafka CLI `kafka-consumer-groups.sh --reset-offsets` syntax is correct; `@JsonProperty` annotations control Jackson mapping.*
