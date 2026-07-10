---
title: "Channel Reliability"
order: 5
part: messaging-channels
description: "Handling failure gracefully — invalid message channels, dead letter channels, and guaranteed delivery."
duration: "35 minutes"
---

The previous chapter covered how messages are delivered — to one consumer or to all. This chapter covers what happens when delivery *fails*. Messages can be malformed, consumers can crash mid-processing, brokers can go down, and networks can partition. The three patterns here — Invalid Message Channel, Dead Letter Channel, and Guaranteed Delivery — are the safety nets that keep a messaging system reliable in the face of real-world failures.

{% include excalidraw.html file="05-reliability-patterns" alt="Dead Letter Channel and Guaranteed Delivery flow" caption="Figure 5.1 — Guaranteed Delivery with Dead Letter Channel as the fallback for exhausted retries." %}

These aren't optional patterns. Any production messaging system needs all three, and most of the operational pain in message-driven architectures comes from getting them wrong.

## Pattern: Invalid Message Channel

### The problem

Inventory-service expects `OrderPlaced` events with an `item_sku`, a `quantity`, and an `amount`. But a bug in order-service sends a message with `quantity: -3`, or with `item_sku` set to `null`, or with a body that isn't valid JSON at all. What should inventory-service do?

It can't process the message — the data is invalid. It shouldn't drop it silently — that loses information and makes debugging impossible. It shouldn't retry it — an invalid message will fail forever. It needs a place to put messages that it *cannot* process so that a human or automated system can inspect and remediate them.

### The solution

An **Invalid Message Channel** is a dedicated channel where consumers send messages they cannot understand or process. It's distinct from a Dead Letter Channel (next pattern): invalid messages are ones the consumer *recognizes* as bad and actively rejects, while dead letters are ones that fail after repeated processing attempts.

The distinction matters operationally. An invalid message usually means a bug in the producer (it sent malformed data) and needs a code fix. A dead letter usually means a transient failure (database timeout, external API down) and may succeed on retry.

### How Camel models it

Camel's `doTry`/`doCatch` blocks let you catch validation failures and route them to an invalid message channel:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
    .routeId("invalid-message-channel")
    .doTry()
        .unmarshal().json(Map.class)
        .process(exchange -> {
            Map<String, Object> body = exchange.getIn().getBody(Map.class);
            if (body.get("item_sku") == null || body.get("item_sku").toString().isBlank()) {
                throw new IllegalArgumentException("Missing item_sku");
            }
            int qty = Integer.parseInt(body.get("quantity").toString());
            if (qty <= 0) {
                throw new IllegalArgumentException("Invalid quantity: " + qty);
            }
        })
        .log("Valid order ${body[order_id]} — processing")
        .to("direct:check-inventory")
    .doCatch(IllegalArgumentException.class)
        .log(LoggingLevel.WARN, "Invalid message rejected: ${exception.message}")
        .setHeader("invalidReason", simple("${exception.message}"))
        .setHeader("originalTopic", constant("eip.orders.placed"))
        .to("kafka:eip.orders.invalid?brokers=localhost:9092")
    .doCatch(Exception.class)
        .log(LoggingLevel.ERROR, "Unexpected error: ${exception.message}")
        .to("kafka:eip.orders.dlq?brokers=localhost:9092")
    .end();
```

Notice the two-tier error handling: `IllegalArgumentException` (validation failures) goes to `eip.orders.invalid`; everything else (unexpected exceptions) goes to `eip.orders.dlq`. This separation lets operations teams apply different alerting and remediation workflows to each category.

## Pattern: Dead Letter Channel

### The problem

Payment-service processes `InventoryReserved` events by calling an external payment gateway. Sometimes the gateway is slow, sometimes it's down, sometimes it returns a transient error. The first failure shouldn't lose the message — it should be retried. But after several retries, the message needs to go somewhere safe where it won't block other messages and where operations can investigate.

### The solution

A **Dead Letter Channel** (DLC, also called a dead letter queue or DLQ) is a channel that receives messages that the messaging system or the consumer could not deliver or process after a configured number of attempts. It's the last-resort safety net: no message is ever silently lost.

Dead letter handling typically involves:

1. **Retry** — Attempt to process the message N times with backoff between attempts.
2. **Escalate** — After N failures, move the message to the dead letter channel.
3. **Preserve context** — Include the original message, the exception, the retry count, and the timestamp in the dead letter so that remediation is possible.
4. **Alert** — Notify operations when messages land in the DLC.

### How Kafka implements it

Kafka itself doesn't have a built-in dead letter queue — it's a broker-level concept that consumer frameworks implement. In our stack:

- **Camel's error handler** manages retries and dead-lettering at the route level.
- The convention is to name the DLC topic `<original-topic>.dlq` — so `eip.orders.placed` has a dead letter at `eip.orders.placed.dlq`.
- Dead-lettered messages carry headers with the failure reason, retry count, and original topic.

### How Pulsar implements it

Pulsar has **native dead letter topic support** built into the consumer:

```
pulsar:persistent://public/default/eip.inventory.reserved
  ?subscriptionName=payment-service
  &deadLetterTopic=persistent://public/default/eip.inventory.reserved-dlq
  &maxRedeliverCount=3
```

After 3 failed redeliveries, Pulsar automatically moves the message to the dead letter topic. No application-level code needed.

### How Camel models it

Camel's `errorHandler` with a `deadLetterChannel` is the standard approach:

```java
from("kafka:eip.inventory.reserved?brokers=localhost:9092&groupId=payment-service")
    .routeId("dead-letter-channel")
    .errorHandler(deadLetterChannel("kafka:eip.inventory.reserved.dlq?brokers=localhost:9092")
        .maximumRedeliveries(3)
        .redeliveryDelay(1000)
        .backOffMultiplier(2.0)
        .retryAttemptedLogLevel(LoggingLevel.WARN)
        .useOriginalMessage()
        .onPrepareFailure(exchange -> {
            Exception cause = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Exception.class);
            exchange.getIn().setHeader("dlqReason", cause != null ? cause.getMessage() : "unknown");
            exchange.getIn().setHeader("dlqTimestamp", System.currentTimeMillis());
            exchange.getIn().setHeader("dlqOriginalTopic", "eip.inventory.reserved");
            exchange.getIn().setHeader("dlqRetryCount",
                exchange.getIn().getHeader(Exchange.REDELIVERY_COUNTER));
        }))
    .unmarshal().json(Map.class)
    .log("Processing payment for order ${body[order_id]}")
    .to("http://payment-gateway.example.com/charge"
        + "?httpMethod=POST&connectTimeout=3000&socketTimeout=10000")
    .log("Payment processed for order ${body[order_id]}");
```

**What happens when the payment gateway fails:**

1. First attempt fails → Camel waits 1 second.
2. Second attempt fails → Camel waits 2 seconds (backoff multiplier 2.0).
3. Third attempt fails → Camel waits 4 seconds.
4. Fourth attempt fails → Message is moved to `eip.inventory.reserved.dlq` with headers containing the failure reason, timestamp, original topic, and retry count.

The `useOriginalMessage()` option is critical: it sends the *original* message body to the DLC, not whatever transformed state the body was in when the error occurred. Without it, the dead-lettered message might be half-processed and unusable for reprocessing.

### Monitoring dead letters

A dead letter topic should always be monitored. In practice, this means:

- An alert fires when *any* message lands in a `.dlq` topic (these should be rare).
- A dashboard shows DLC depth over time (growing depth = systematic problem).
- A remediation tool or script can replay dead-lettered messages back to the original topic after the root cause is fixed.

## Pattern: Guaranteed Delivery

### The problem

Order-service emits an `OrderPlaced` event to Kafka. Between the moment the event leaves order-service and the moment inventory-service processes it, several things could fail: the Kafka broker could crash, the network between order-service and Kafka could drop, or inventory-service could be down for deployment. If any of these happen, the event must not be lost — the customer placed an order and expects it to be fulfilled.

### The solution

**Guaranteed Delivery** ensures that a message, once accepted by the messaging system, will be delivered to the consumer even if the system experiences failures. The mechanism is **persistent storage**: the messaging system writes messages to durable storage (disk) before acknowledging receipt. Even if the broker restarts, the messages survive.

Guaranteed delivery is a spectrum, not a binary:

| Level | Guarantee | Kafka Config | Trade-off |
|-------|-----------|-------------|-----------|
| **Fire and forget** | None — message may be lost | `acks=0` | Highest throughput, no durability |
| **Leader acknowledged** | Survives leader crash if replicas caught up | `acks=1` | Good throughput, some risk |
| **All replicas acknowledged** | Survives any single broker failure | `acks=all` + `min.insync.replicas=2` | Lower throughput, strongest guarantee |
| **Exactly once** | No duplicates, no loss | Kafka transactions + idempotent producer | Lowest throughput, strongest guarantee |

### How Kafka implements it

Kafka's durability guarantees come from three layers:

1. **Producer acknowledgment** (`acks`) — How many brokers must confirm receipt before the producer considers the send successful.
2. **Replication** (`replication.factor`, `min.insync.replicas`) — How many copies of each partition exist across brokers.
3. **Consumer offset management** — Whether the consumer commits its position before or after processing.

In our local stack, we're running a single broker, so replication doesn't apply (replication factor is 1). In production, you'd configure `acks=all` with a replication factor of 3 and `min.insync.replicas=2` — meaning a write succeeds only after 2 of 3 replicas confirm it.

### How Camel models it

```java
// Producer with guaranteed delivery settings
from("direct:place-order-guaranteed")
    .routeId("guaranteed-delivery-producer")
    .marshal().json()
    .to("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&requestRequiredAcks=all"
        + "&retries=3"
        + "&enableIdempotence=true"
        + "&maxInFlightRequest=5"
        + "&key=${header.orderId}");

// Consumer with manual offset commit (process-then-commit)
from("kafka:eip.orders.placed"
        + "?brokers=localhost:9092"
        + "&groupId=inventory-service"
        + "&autoCommitEnable=false"
        + "&allowManualCommit=true"
        + "&breakOnFirstError=true")
    .routeId("guaranteed-delivery-consumer")
    .unmarshal().json(Map.class)
    .log("Processing order ${body[order_id]}")
    .to("direct:check-inventory")
    // Commit offset AFTER successful processing
    .process(exchange -> {
        exchange.getIn()
            .getHeader(org.apache.camel.component.kafka.KafkaConstants.MANUAL_COMMIT,
                       org.apache.camel.component.kafka.KafkaManualCommit.class)
            .commit();
    })
    .log("Offset committed for order ${body[order_id]}");
```

**The producer side:** `requestRequiredAcks=all` means Kafka won't acknowledge the send until all in-sync replicas have written the message. `enableIdempotence=true` prevents duplicates if the producer retries a send that actually succeeded (the broker deduplicates by producer ID and sequence number). `retries=3` automatically retries transient failures.

**The consumer side:** `autoCommitEnable=false` and `allowManualCommit=true` give the consumer explicit control over when to commit the offset. The offset is committed *after* successful processing — so if the consumer crashes before committing, the message will be redelivered on the next poll. This is **at-least-once** delivery: guaranteed not to lose messages, but may deliver duplicates. Handling duplicates is the Idempotent Receiver pattern (Part 7).

`breakOnFirstError=true` is critical: without it, Camel continues processing the next message in the poll batch even if the current one fails. With it, Camel stops the batch at the first error, allowing the failed message to be retried.

## Common pitfalls

**Auto-committing offsets.** Kafka's default is `enable.auto.commit=true` with a 5-second interval. This means the offset is committed periodically, regardless of whether the message was processed. If the consumer crashes between auto-commit and processing, the message is lost. For guaranteed delivery, always use manual commit.

**Not distinguishing invalid from dead.** Sending all errors to the same DLC makes remediation harder. Invalid messages need a code fix in the producer; dead letters may just need a retry after the downstream system recovers. Separate channels, separate alerting.

**Ignoring the DLC.** A dead letter channel is only useful if someone watches it. Unmonitored DLCs accumulate messages silently until a customer notices their order was never fulfilled.

**Retrying non-retryable errors.** A `NullPointerException` from a validation failure will never succeed on retry — it'll fail 3 times and dead-letter, wasting time and resources. Use the Invalid Message Channel for validation failures; reserve the DLC for transient errors.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 4: "Messaging Channels"
- [enterpriseintegrationpatterns.com — Invalid Message Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/InvalidMessageChannel.html)
- [enterpriseintegrationpatterns.com — Dead Letter Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html)
- [enterpriseintegrationpatterns.com — Guaranteed Delivery](https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)
- [Apache Camel — Error Handler](https://camel.apache.org/manual/error-handler.html)
- [Apache Camel — Dead Letter Channel](https://camel.apache.org/components/4.20.x/eips/dead-letter-channel.html)
- [Apache Kafka — Producer Configs](https://kafka.apache.org/documentation/#producerconfigs)

## What you learned

- **Invalid Message Channel** is for messages the consumer *recognizes* as bad — route them to a dedicated channel for producer bug investigation.
- **Dead Letter Channel** is the last-resort safety net for messages that fail after exhausting retries — never silently drop a message.
- **Guaranteed Delivery** is a spectrum from fire-and-forget to exactly-once, configured through producer acks, broker replication, and consumer offset management.
- Manual offset commit (`autoCommitEnable=false`) is essential for at-least-once processing in Kafka.

Next, we look at the infrastructure-level channel patterns: Channel Adapter, Messaging Bridge, and Message Bus.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Camel deadLetterChannel builder API matches 4.20; `useOriginalMessage()` behavior is as described; `breakOnFirstError` parameter exists on the Kafka component; `allowManualCommit`/`KafkaManualCommit` API is current in camel-kafka 4.20; Pulsar dead letter topic parameter names are correct.*
