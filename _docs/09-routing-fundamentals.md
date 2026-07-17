---
title: "Routing Fundamentals"
order: 9
part: message-routing
description: "Content-Based Router, Message Filter, Recipient List, and Splitter — the four patterns that determine where a message goes based on its content."
duration: "45 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/09-routing-fundamentals/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/09-routing-fundamentals) with subdirectories for each runtime.

{% include codetabs.html langs="Quarkus|Spring Boot|YAML DSL" %}

```bash
# Quarkus
cd examples/09-routing-fundamentals/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/09-routing-fundamentals/spring-boot
mvn spring-boot:run
```

```bash
# YAML DSL (Camel CLI)
cd examples/09-routing-fundamentals/yaml-dsl
camel run *
```

Message Routing is where integration gets interesting. So far, messages flow in straight lines — from producer to channel to consumer. But real systems have branches: this order goes to the express lane, that one to standard processing; international shipments route to customs, domestic ones skip it; high-value orders trigger fraud checks, low-value ones don't.

{% include excalidraw.html file="09-routing-patterns" alt="Content-Based Router, Splitter, and Recipient List" caption="Figure 9.1 — Three fundamental routing patterns: route by content, split into parts, fan out to a dynamic list." %}

This chapter covers four foundational routing patterns that make these decisions. The next two chapters cover composed routers (routing slip, process manager) and advanced patterns (load balancer, dynamic router, resequencer).

## Pattern: Content-Based Router

### The problem

When an `OrderPlaced` event arrives, the shipping-service needs to route it differently based on the destination:

- **Domestic orders** go to the standard fulfillment center.
- **International orders** go to the international logistics handler, which deals with customs declarations and duties.
- **Express orders** go to the priority queue, regardless of destination.
- **Hazardous materials** go to the specialized hazmat handler.

The message content determines the route. The routing logic needs to be clean, maintainable, and extensible — adding a new category shouldn't require rewriting the existing logic.

### The solution

A **Content-Based Router** inspects the message body or headers and routes the message to the appropriate channel based on the content. It's a message-level `if-else` or `switch` statement — but it separates the routing decision from the processing logic.

Camel implements this with the `choice()` EIP, which is arguably the most-used pattern in any Camel application.

### How Camel models it

The route logic is identical across runtimes — only the class annotations differ:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
// Quarkus — CDI discovers the route via @ApplicationScoped
@ApplicationScoped
public class ContentBasedRouterRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=shipping-router")
            .routeId("content-based-router")
            // route logic below...
    }
}
```

```java
// Spring Boot — Spring discovers the route via @Component
@Component
public class ContentBasedRouterRoute extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=shipping-router")
            .routeId("content-based-router")
            // route logic below...
    }
}
```

The `choice()` DSL inside `configure()` is pure Camel — identical on both runtimes:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=shipping-router")
    .routeId("content-based-router")
    .unmarshal().json(Map.class)
    .log("Routing order ${body[order_id]} — destination: ${body[destination_country]}, "
        + "priority: ${body[shipping_priority]}, hazmat: ${body[contains_hazmat]}")
    .choice()
        .when(simple("${body[contains_hazmat]} == true"))
            .log("Routing to hazmat handler")
            .to("kafka:eip.shipping.hazmat?brokers=localhost:9092")
        .when(simple("${body[shipping_priority]} == 'EXPRESS'"))
            .log("Routing to express fulfillment")
            .to("kafka:eip.shipping.express?brokers=localhost:9092")
        .when(simple("${body[destination_country]} != 'US'"))
            .log("Routing to international logistics")
            .to("kafka:eip.shipping.international?brokers=localhost:9092")
        .otherwise()
            .log("Routing to standard fulfillment")
            .to("kafka:eip.shipping.standard?brokers=localhost:9092")
    .end();
```

### Evaluation order matters

`choice()` evaluates predicates top-to-bottom and takes the **first match**. This means:
- Hazmat is checked first because it overrides everything else — a hazmat express international order goes to hazmat, not express.
- Express is checked before international because express priority overrides destination-based routing.
- `otherwise()` is the catch-all. Without it, messages that don't match any predicate are silently dropped.

### Using `camel trace` to debug routing decisions

When prototyping with JBang, use `camel trace` to see exactly which branch each message takes:

```bash
# Terminal 1: run the route
camel run shipping-router.yaml --dev

# Terminal 2: trace the route
camel trace shipping-router

# Watch each message flow through the choice branches in real time
```

`camel trace` shows the exchange as it passes through each EIP step, including which `when` predicate matched. This is invaluable for verifying routing logic before deploying.

### When the CBR grows too large

A content-based router with more than 5-7 branches becomes hard to maintain. At that point, consider:
- **Recipient List** (below) — if the routing logic determines *multiple* destinations.
- **Dynamic Router** (Chapter 11) — if the routing logic changes frequently or is externalized.
- **Routing Slip** (Chapter 10) — if the message needs to visit a *sequence* of destinations determined at runtime.

## Pattern: Message Filter

### The problem

Notification-service subscribes to the `eip.orders.placed` topic to send order confirmations. But it only sends confirmations for orders above $50 (small orders get a batch digest email at the end of the day). Rather than processing every message and discarding the ones below $50 inside the handler, it's cleaner to filter them out before they reach the handler.

### The solution

A **Message Filter** is a router with two outputs: messages that match the predicate pass through, and messages that don't are silently discarded (or optionally routed to a "rejected" channel). It's a specialized content-based router with only one branch.

### How Camel models it

Camel's `filter()` EIP passes messages that match and drops the rest:

```java
// Only process orders above $50
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=notification-filter")
    .routeId("message-filter")
    .unmarshal().json(Map.class)
    .filter(simple("${body[amount]} >= 50"))
        .log("Processing high-value order ${body[order_id]}: $${body[amount]}")
        .to("direct:send-confirmation-email")
    .end()
    .log("Filter passed ${header.CamelFilterMatched} for order");
```

### Filter vs. choice

A filter is syntactic sugar for a choice with one branch:

```java
// These are functionally identical:
.filter(simple("${body[amount]} >= 50"))
    .to("direct:process")
.end()

.choice()
    .when(simple("${body[amount]} >= 50"))
        .to("direct:process")
.end()
```

Use `filter()` when you have a single pass/drop decision. Use `choice()` when you have multiple branches. The semantic difference matters for readability — a `filter` communicates intent better than a one-branch `choice`.

### Tracking filtered messages

Silently dropping messages is dangerous in production. You can't tell if a filter is working correctly or if it's accidentally dropping everything. Add logging or metrics:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=notification-filter")
    .routeId("message-filter-with-tracking")
    .unmarshal().json(Map.class)
    .choice()
        .when(simple("${body[amount]} >= 50"))
            .to("direct:send-confirmation-email")
        .otherwise()
            .log("Filtered: order ${body[order_id]} below threshold ($${body[amount]})")
            .to("micrometer:counter:orders.filtered?tags=reason=below-threshold")
    .end();
```

The `micrometer` component increments a Prometheus counter for filtered messages, so you can alert on unexpected filter rates.

## Pattern: Recipient List

### The problem

When a high-value order ($1,000+) is placed, it needs to go to *multiple* destinations simultaneously: fulfillment, fraud detection, VIP customer service, and executive reporting. A content-based router sends to one destination; a recipient list sends to *many*.

The destinations might be static (always the same four) or dynamic (determined at runtime based on the order amount, customer tier, product category, etc.).

### The solution

A **Recipient List** evaluates the message and sends copies to multiple channels determined at runtime. Unlike publish-subscribe (which sends to *all* subscribers of a topic), a recipient list selectively determines the recipients per message.

### How Camel models it

Camel's `recipientList()` EIP takes an expression that resolves to a comma-separated list of endpoint URIs:

```java
// Static recipient list: always send high-value orders to these destinations
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=high-value-router")
    .routeId("recipient-list-static")
    .unmarshal().json(Map.class)
    .filter(simple("${body[amount]} >= 1000"))
        .recipientList(constant(
            "direct:fulfillment,"
            + "direct:fraud-detection,"
            + "direct:vip-service,"
            + "direct:executive-reporting"))
        .parallelProcessing()
    .end();

// Dynamic recipient list: determine destinations based on content
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=dynamic-router")
    .routeId("recipient-list-dynamic")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        StringBuilder recipients = new StringBuilder("direct:fulfillment");

        double amount = ((Number) order.get("amount")).doubleValue();
        if (amount >= 1000) {
            recipients.append(",direct:fraud-detection,direct:vip-service");
        }
        if (amount >= 5000) {
            recipients.append(",direct:executive-reporting");
        }
        String country = (String) order.get("destination_country");
        if (!"US".equals(country)) {
            recipients.append(",direct:customs-declaration");
        }
        exchange.getIn().setHeader("routingTargets", recipients.toString());
    })
    .recipientList(header("routingTargets"))
        .parallelProcessing()
        .stopOnException();
```

### Key options

- **`parallelProcessing()`** — Sends to all recipients concurrently. Without this, recipients are called sequentially (each waits for the previous to complete).
- **`stopOnException()`** — If one recipient fails, stop sending to remaining recipients. Without this, all recipients are attempted regardless of failures.
- **`ignoreInvalidEndpoints()`** — Skip endpoints that can't be resolved instead of failing the entire exchange.

### Recipient list vs. publish-subscribe

| Dimension | Recipient List | Publish-Subscribe |
|-----------|---------------|-------------------|
| **Decision point** | The router decides per message | The subscriber decides by subscribing |
| **Who controls routing** | The sender (or a router service) | The receiver |
| **Dynamic** | Fully — recipients change per message | Semi — subscribers are relatively static |
| **Coupling** | Sender knows the recipient list logic | Sender doesn't know who's listening |

Use publish-subscribe (Kafka consumer groups) when subscribers manage themselves. Use a recipient list when a central router needs to determine per-message routing.

## Pattern: Splitter

### The problem

A bulk order arrives with 50 line items. Each line item needs independent processing: different SKUs go to different warehouses, different quantities trigger different procurement rules, some items are in stock and some aren't. Processing the entire order as a unit forces you to handle all 50 items in one transaction — and a failure on item 47 affects the other 49.

### The solution

A **Splitter** breaks a single composite message into individual parts and routes each part independently. Each part is processed as a separate exchange, so a failure on one part doesn't affect the others.

We saw the Splitter briefly in Chapter 08 (Message Sequence). Here, we explore it in depth as a routing pattern.

### How Camel models it

Camel's `split()` EIP breaks a message based on an expression — a JSONPath, XPath, tokenizer, or custom logic:

```java
// Split a bulk order into individual line items
from("kafka:eip.orders.bulk?brokers=localhost:9092&groupId=order-splitter")
    .routeId("splitter")
    .unmarshal().json(Map.class)
    .log("Received bulk order ${body[order_id]} with ${body[line_items].size()} items")
    .setHeader("originalOrderId", simple("${body[order_id]}"))
    .split(jsonpath("$.line_items"))
        .log("Processing item ${header.CamelSplitIndex} of ${header.CamelSplitSize}: "
            + "SKU ${body[item_sku]}, qty ${body[quantity]}")
        // Route each item to the appropriate warehouse
        .choice()
            .when(simple("${body[warehouse]} == 'EAST'"))
                .to("kafka:eip.fulfillment.east?brokers=localhost:9092")
            .when(simple("${body[warehouse]} == 'WEST'"))
                .to("kafka:eip.fulfillment.west?brokers=localhost:9092")
            .otherwise()
                .to("kafka:eip.fulfillment.default?brokers=localhost:9092")
        .end()
    .end()
    .log("All items from order ${header.originalOrderId} dispatched");
```

### Split options

- **`streaming()`** — Process items as they're parsed, without loading the entire collection into memory. Essential for large payloads.
- **`parallelProcessing()`** — Process split items concurrently. Uses a thread pool to parallelize item processing.
- **`stopOnException()`** — Stop splitting on the first error. Without this, all items are attempted.
- **`aggregationStrategy()`** — Collect the results of all split items and reassemble them. This is the Splitter-Aggregator pattern, covered in Chapter 12 (Message Transformation).

### Split headers

Every split exchange gets metadata headers:

| Header | Description |
|--------|-------------|
| `CamelSplitIndex` | Zero-based index of the current item |
| `CamelSplitSize` | Total number of items (if known) |
| `CamelSplitComplete` | `true` for the last item |

These headers are essential for logging, monitoring, and (on the receiving side) aggregation.

### Composing patterns: CBR inside a Splitter

The example above shows a common composition: split the message, then route each part with a content-based router. This is powerful because each item is independently routed — item 1 might go to EAST, item 2 to WEST, item 3 to the default warehouse. Without splitting, you'd need to route the entire order to a single destination.

## Common pitfalls

**Content-based routers with no `otherwise()`.** If a message doesn't match any `when` predicate and there's no `otherwise`, it's silently dropped. Always include an `otherwise()` — even if it just logs a warning and sends to a dead letter channel.

**Filters that drop too much.** A filter with no logging is a black hole. If the filter predicate is wrong, you won't know messages are being dropped. Add metrics or logging for filtered messages.

**Recipient lists with untrusted expressions.** If the recipient list reads destinations from message headers, a malicious sender could inject arbitrary endpoint URIs. Use `ignoreInvalidEndpoints()` and validate the header before using it.

**Splitting without backpressure.** If you split a message into 10,000 parts and process them all in parallel, you'll overwhelm downstream systems. Use `streaming()` to process items incrementally, and consider throttling with `throttle()` before the downstream `to()`.

## Runtime configuration

The routing patterns above use the same Camel Java DSL on both Quarkus and Spring Boot. The differences are in project setup and configuration:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties
quarkus.application.name=eip-routing-fundamentals
kafka.brokers=localhost:9092
quarkus.http.port=8082
quarkus.kafka.devservices.enabled=false
quarkus.log.category."org.apache.camel".level=INFO
```

```properties
# Spring Boot — application.properties
spring.application.name=eip-routing-fundamentals
kafka.brokers=localhost:9092
server.port=8082
logging.level.org.apache.camel=INFO
```

The `kafka.brokers` property placeholder is shared — both runtimes resolve `{% raw %}{{kafka.brokers}}{% endraw %}` from the same key.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 7: "Message Routing"
- [enterpriseintegrationpatterns.com — Content-Based Router](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ContentBasedRouter.html)
- [enterpriseintegrationpatterns.com — Message Filter](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Filter.html)
- [enterpriseintegrationpatterns.com — Recipient List](https://www.enterpriseintegrationpatterns.com/patterns/messaging/RecipientList.html)
- [enterpriseintegrationpatterns.com — Splitter](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Sequencer.html)
- [Apache Camel — Choice EIP](https://camel.apache.org/components/4.20.x/eips/choice-eip.html)
- [Apache Camel — Filter EIP](https://camel.apache.org/components/4.20.x/eips/filter-eip.html)
- [Apache Camel — Recipient List EIP](https://camel.apache.org/components/4.20.x/eips/recipientList-eip.html)
- [Apache Camel — Splitter EIP](https://camel.apache.org/components/4.20.x/eips/split-eip.html)

## What you learned

- **Content-Based Router** (`choice()`) inspects message content and routes to the matching channel — the most-used routing pattern.
- **Message Filter** (`filter()`) passes matching messages and discards the rest — a one-branch router optimized for pass/drop decisions.
- **Recipient List** (`recipientList()`) sends copies to multiple destinations determined per message — for when one message needs to reach several handlers.
- **Splitter** (`split()`) breaks a composite message into parts for independent processing — essential for bulk operations and per-item routing.

Next, we compose these primitives into multi-step routing patterns: the Routing Slip, Process Manager, and Scatter-Gather.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0. YAML DSL routes provided for Camel CLI.*
