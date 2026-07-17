---
title: "Producer and Transactional Patterns"
order: 15
part: messaging-endpoints
description: "Durable Subscriber, Idempotent Receiver, Transactional Client, and Service Activator — patterns for reliable message production and exactly-once processing."
duration: "40 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/15-endpoints/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/15-endpoints) with subdirectories for each runtime.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/15-endpoints/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/15-endpoints/spring-boot
mvn spring-boot:run
```

The previous chapter covered how consumers receive messages. This chapter covers the other side: how producers send messages durably, how consumers guarantee exactly-once processing, how transactions span messaging and database operations, and how messaging integrates with service-oriented application code.

{% include excalidraw.html file="15-outbox-pattern" alt="Outbox Pattern for transactional messaging" caption="Figure 15.1 — The Outbox pattern ensures atomic writes to the database and eventual publication to Kafka." %}

## Pattern: Durable Subscriber

### The problem

Notification-service subscribes to `OrderPlaced` events. But notification-service goes down for maintenance every Sunday at 2 AM. Orders placed during the maintenance window — when the subscriber is offline — would be missed. When notification-service restarts, it should receive all the events it missed, not just future ones.

### The solution

A **Durable Subscriber** maintains its subscription state even when disconnected. The messaging system tracks which messages the subscriber has consumed (via offsets or cursors), and when the subscriber reconnects, it resumes from where it left off — no messages lost.

In Kafka, every consumer group is a durable subscriber by default. Kafka stores the consumer group's offset for each partition. When the consumer restarts, it reads from the last committed offset.

### How Camel models it

```java
// Kafka durable subscriber: the consumer group persists offsets automatically
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=notification-service"
        + "&autoOffsetReset=earliest"       // start from the beginning if no offset exists
        + "&autoCommitEnable=true"          // commit offsets automatically
        + "&autoCommitIntervalMs=5000")     // commit every 5 seconds
    .routeId("durable-subscriber-auto")
    .unmarshal().json(Map.class)
    .log("Processing order ${body[order_id]}")
    .to("direct:send-notification");

// Manual offset commit for more control
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=notification-service-manual"
        + "&autoCommitEnable=false"
        + "&allowManualCommit=true"
        + "&autoOffsetReset=earliest")
    .routeId("durable-subscriber-manual")
    .unmarshal().json(Map.class)
    .to("direct:send-notification")
    .process(exchange -> {
        // Commit offset only after successful processing
        exchange.getIn()
            .getHeader(org.apache.camel.component.kafka.KafkaConstants.MANUAL_COMMIT,
                org.apache.camel.component.kafka.KafkaManualCommit.class)
            .commit();
    })
    .log("Offset committed for order ${body[order_id]}");
```

### Auto-commit vs. manual commit

| Mode | Guarantee | Risk |
|------|-----------|------|
| Auto-commit | At-most-once | If processing fails after offset commit, the message is lost |
| Manual commit after processing | At-least-once | If the consumer crashes after processing but before commit, the message is reprocessed |

For our shipping domain, at-least-once with manual commit is the safe default. The cost of a duplicate notification is low (an extra email). The cost of a missed notification is high (customer never knows their order shipped). The next pattern — Idempotent Receiver — handles the duplicates.

### Pulsar durable subscriptions

Pulsar's subscription model is also durable by default. The subscription maintains a cursor that tracks acknowledged messages. Unacknowledged messages are redelivered:

```java
from("pulsar:persistent://public/default/eip.orders.placed"
        + "?subscriptionName=notification-service"
        + "&subscriptionType=Shared"
        + "&ackTimeoutMillis=30000")  // redeliver if not acked within 30s
    .routeId("durable-subscriber-pulsar")
    .log("Processing order from Pulsar")
    .to("direct:send-notification");
```

## Pattern: Idempotent Receiver

### The problem

With at-least-once delivery, the same message can be delivered more than once: a Kafka rebalance during processing, a consumer crash after processing but before offset commit, a network glitch causing a retry. If payment-service processes the same `InventoryReserved` event twice, it charges the customer twice. If notification-service processes the same `ShipmentScheduled` event twice, the customer gets two "your order shipped" emails.

### The solution

An **Idempotent Receiver** (also called Idempotent Consumer) tracks which messages have already been processed and skips duplicates. It maintains a set of processed message IDs and checks each incoming message against the set.

### How Camel models it

Camel's `idempotentConsumer()` EIP handles this directly:

```java
// In-memory idempotent consumer (for development/testing)
from("kafka:eip.payments.required?brokers=localhost:9092&groupId=payment-service")
    .routeId("idempotent-receiver-memory")
    .unmarshal().json(Map.class)
    .idempotentConsumer(
        simple("${body[event_id]}"),
        MemoryIdempotentRepository.memoryIdempotentRepository(1000))
    .log("Processing payment for order ${body[order_id]}")
    .to("direct:process-payment");

// Redis-backed idempotent consumer (for production)
from("kafka:eip.payments.required?brokers=localhost:9092&groupId=payment-service-prod")
    .routeId("idempotent-receiver-redis")
    .unmarshal().json(Map.class)
    .idempotentConsumer(
        simple("${body[event_id]}"),
        new org.apache.camel.component.redis.processor.idempotent
            .RedisIdempotentRepository(redisClient, "payment-idempotent"))
    .skipDuplicate(true)
    .log("Processing payment for order ${body[order_id]} (event ${body[event_id]})")
    .to("direct:process-payment");

// JDBC-backed idempotent consumer (when Redis isn't available)
from("kafka:eip.shipping.scheduled?brokers=localhost:9092&groupId=shipping-service")
    .routeId("idempotent-receiver-jdbc")
    .unmarshal().json(Map.class)
    .idempotentConsumer(
        simple("${body[event_id]}"),
        new org.apache.camel.processor.idempotent.jdbc
            .JdbcMessageIdRepository(dataSource, "shipping_idempotent"))
    .log("Scheduling shipment for order ${body[order_id]}")
    .to("direct:schedule-shipment");
```

### Choosing the repository

| Repository | Durability | Speed | Use case |
|-----------|-----------|-------|----------|
| `MemoryIdempotentRepository` | None (lost on restart) | Fastest | Development, testing |
| `RedisIdempotentRepository` | Persistent, distributed | Fast | Production (recommended) |
| `JdbcMessageIdRepository` | Persistent | Moderate | Production (when Redis unavailable) |
| `InfinispanIdempotentRepository` | Persistent, clustered | Fast | High-availability clusters |

For our shipping domain, Redis is already in the stack — so `RedisIdempotentRepository` is the natural choice for production. The idempotent key is `event_id` from the event envelope (Chapter 07 / 12).

### Why `event_id` matters

This is why we put `event_id` in the event envelope from the beginning. Without a unique per-message ID, you'd have to use a combination of fields (`order_id` + `event_type` + timestamp) for deduplication — which is fragile. A UUID per event makes idempotent consumption straightforward.

## Pattern: Transactional Client

### The problem

When payment-service processes a payment, it needs to:
1. Insert a payment record into PostgreSQL.
2. Publish a `PaymentProcessed` event to Kafka.

If the database insert succeeds but the Kafka publish fails, the payment is recorded but no event is emitted — downstream services never know the payment was processed. If the Kafka publish succeeds but the database insert fails (crash between the two), an event announces a payment that never happened.

You need both operations to succeed or both to fail — a transaction that spans the database and the message broker.

### The solution

A **Transactional Client** makes the sending or receiving of messages part of a transaction. In the simplest case, this means wrapping messaging operations in a database transaction so that both succeed or both are rolled back.

True distributed transactions (XA/2PC) across a database and a message broker are complex and often impractical with Kafka (which doesn't support XA). The practical alternative is the **Outbox Pattern**: write the event to a database table within the same transaction as the business operation, then publish from the table to Kafka asynchronously.

### How Camel models it

**The Outbox Pattern — database-first, publish-after:**

```java
// Step 1: Write both the payment record and the outbox event in one DB transaction
from("kafka:eip.payments.required?brokers=localhost:9092&groupId=payment-service")
    .routeId("transactional-client")
    .unmarshal().json(Map.class)
    .transacted("PROPAGATION_REQUIRED")
    .log("Processing payment for order ${body[order_id]}")
    // Business operation: insert payment record
    .to("sql:INSERT INTO payments.payments (order_id, amount, status) "
        + "VALUES (:#${body[order_id]}, :#${body[amount]}, 'PROCESSED')"
        + "?dataSource=#paymentDataSource")
    // Outbox: write event to outbox table (same transaction)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        Map<String, Object> event = new java.util.LinkedHashMap<>();
        event.put("event_type", "PaymentProcessed");
        event.put("event_id", java.util.UUID.randomUUID().toString());
        event.put("order_id", order.get("order_id"));
        event.put("amount", order.get("amount"));
        event.put("payload", new com.fasterxml.jackson.databind.ObjectMapper()
            .writeValueAsString(event));
        exchange.getIn().setBody(event);
    })
    .to("sql:INSERT INTO payments.outbox (event_id, event_type, aggregate_id, payload) "
        + "VALUES (:#${body[event_id]}, :#${body[event_type]}, "
        + ":#${body[order_id]}, :#${body[payload]})"
        + "?dataSource=#paymentDataSource");
    // Transaction commits here — both payment and outbox written atomically

// Step 2: Poll the outbox and publish to Kafka
from("sql:SELECT * FROM payments.outbox WHERE published = false "
        + "ORDER BY created_at LIMIT 100"
        + "?dataSource=#paymentDataSource"
        + "&delay=1000"
        + "&onConsume=UPDATE payments.outbox SET published = true WHERE event_id = :#event_id")
    .routeId("outbox-publisher")
    .marshal().json()
    .to("kafka:eip.payments.processed?brokers=localhost:9092"
        + "&requestRequiredAcks=all")
    .log("Published outbox event ${body[event_id]} to Kafka");
```

### The outbox pattern guarantees

1. **Atomicity** — The payment record and the outbox event are written in the same database transaction. Either both exist or neither does.
2. **Eventual consistency** — The outbox publisher polls the table and publishes to Kafka. If the publisher crashes, it retries on restart — events are published at-least-once.
3. **Ordering** — Events are published in `created_at` order, preserving the temporal ordering of business operations.

Combined with the Idempotent Receiver on the consumer side, the outbox pattern gives you effectively-once processing across the database-to-Kafka boundary.

## Pattern: Service Activator

### The problem

You have a CDI bean (`PaymentProcessor`) that contains your payment processing business logic. You want to connect it to the messaging system — call it when a message arrives and publish the result — without coupling the bean to Camel or Kafka.

### The solution

A **Service Activator** connects a message channel to application code. It receives a message, invokes the appropriate business logic, and optionally sends the result to an output channel. The service (your CDI bean) remains unaware of the messaging infrastructure — the activator handles the translation.

### How Camel models it

Camel's `bean()` method and CDI integration make the service activator pattern nearly invisible:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
// Quarkus — CDI discovers the service via @ApplicationScoped
@ApplicationScoped
@Named("paymentProcessor")
public class PaymentProcessor {
```

```java
// Spring Boot — Spring discovers the service via @Component
@Component("paymentProcessor")
public class PaymentProcessor {
```

```java
    @Inject
    PaymentGateway gateway;

    public PaymentResult processPayment(Map<String, Object> order) {
        String orderId = (String) order.get("order_id");
        double amount = ((Number) order.get("amount")).doubleValue();

        PaymentResult result = gateway.charge(orderId, amount);
        return result;
    }
}

// The activator — connects messaging to the service
from("kafka:eip.payments.required?brokers=localhost:9092&groupId=payment-activator")
    .routeId("service-activator")
    .unmarshal().json(Map.class)
    .bean("paymentProcessor", "processPayment")
    .marshal().json()
    .to("kafka:eip.payments.processed?brokers=localhost:9092");
```

### Why it matters

The service activator pattern keeps your business logic clean. `PaymentProcessor` is a testable CDI bean — you can unit-test it with a mock `PaymentGateway` without starting Camel or Kafka. The Camel route is pure wiring — it connects the Kafka topic to the bean and the bean's output to the next topic. If you later switch from Kafka to Pulsar, the bean doesn't change — only the route.

## Common pitfalls

**Auto-commit with slow processing.** If auto-commit fires every 5 seconds but your processing takes 10 seconds, the offset is committed before processing finishes. A crash loses the unfinished message. Use manual commit for anything that takes more than a few hundred milliseconds.

**Idempotent repositories without TTL.** If the idempotent repository grows forever, it eventually uses all available memory or disk. Set a TTL (time-to-live) on entries — for our shipping domain, 7 days is enough (orders older than 7 days won't be replayed).

**Outbox tables without cleanup.** Published outbox events should be deleted or archived periodically. A background job that deletes `published = true AND created_at < NOW() - INTERVAL '7 days'` keeps the table manageable.

**Service activators with side effects in the bean.** If the bean sends an email as part of processing, and the route retries on failure, the email is sent multiple times. Keep beans pure (return a result, don't execute side effects) or make side effects idempotent.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 9: "Messaging Endpoints"
- [enterpriseintegrationpatterns.com — Durable Subscriber](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DurableSubscription.html)
- [enterpriseintegrationpatterns.com — Idempotent Receiver](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)
- [enterpriseintegrationpatterns.com — Transactional Client](https://www.enterpriseintegrationpatterns.com/patterns/messaging/TransactionalClient.html)
- [enterpriseintegrationpatterns.com — Service Activator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessagingAdapter.html)
- [Apache Camel — Idempotent Consumer EIP](https://camel.apache.org/components/4.20.x/eips/idempotentConsumer-eip.html)
- [Apache Camel — Transactional Client](https://camel.apache.org/manual/transactional-client.html)

## What you learned

- **Durable Subscriber** persists subscription state so no messages are lost during downtime — Kafka consumer groups are durable by default.
- **Idempotent Receiver** deduplicates messages using a persistent ID store — essential for at-least-once delivery with side-effect-free processing.
- **Transactional Client** ensures atomicity across database and messaging operations — the outbox pattern is the practical solution when XA isn't available.
- **Service Activator** connects plain business logic (CDI beans) to the messaging infrastructure — keeping business code free of messaging concerns.

Next: endpoint lifecycle and management — Messaging Gateway, Channel Purger, and Selective Consumer.

---

*Verification status: Quarkus variant verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
