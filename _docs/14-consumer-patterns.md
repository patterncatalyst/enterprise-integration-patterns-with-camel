---
title: "Consumer Patterns"
order: 14
part: messaging-endpoints
description: "Polling Consumer, Event-Driven Consumer, Competing Consumers, and Message Dispatcher — patterns that determine how application code receives messages."
duration: "40 minutes"
---

So far, we've treated the connection between a Camel route and a messaging system as a simple `from()` statement. But the *way* a consumer connects to a channel — polling vs. event-driven, single vs. competing, direct delivery vs. dispatched — fundamentally affects throughput, latency, resource usage, and scalability. These are the Messaging Endpoint patterns, and they sit at the boundary between the messaging system and your application code.

{% include excalidraw.html file="14-consumer-patterns" alt="Competing Consumers and Event-Driven Consumer" caption="Figure 14.1 — Competing Consumers scale horizontally; Event-Driven Consumers react to message arrival." %}

This chapter covers four consumer-side patterns. The next two chapters cover producer-side patterns, transactional messaging, and system-level endpoint management.

## Pattern: Polling Consumer

### The problem

A file-based integration drops CSV order files into a directory. The files appear at unpredictable intervals — sometimes every second, sometimes hours apart. The application needs to check for new files periodically and process them when they arrive.

Similarly, a database table receives new rows from a legacy system. There's no event notification — the only way to detect new rows is to poll the table.

### The solution

A **Polling Consumer** actively checks a channel for new messages at regular intervals. It initiates the receive operation — the messaging system doesn't push messages to it. This is the "pull" model.

Polling consumers are appropriate when:
- The source doesn't support push (files, database tables, FTP servers).
- You want to control the rate at which messages are consumed (backpressure).
- You need to batch messages (poll N messages at a time).

### How Camel models it

Many Camel components are polling consumers by nature. The `file`, `ftp`, `sql`, `timer`, and `scheduler` components all poll their source:

```java
// File polling consumer: check for new CSV files every 10 seconds
from("file:data/incoming?include=.*\\.csv"
        + "&move=.done"
        + "&delay=10000"
        + "&sortBy=file:modified"
        + "&maxMessagesPerPoll=5")
    .routeId("polling-consumer-file")
    .log("Processing file: ${header.CamelFileName}")
    .unmarshal().csv()
    .split(body())
        .to("direct:process-csv-row")
    .end();

// Database polling consumer: check for unprocessed orders every 30 seconds
from("sql:SELECT * FROM orders.orders WHERE status = 'NEW' "
        + "ORDER BY created_at LIMIT 10"
        + "?dataSource=#orderDataSource"
        + "&delay=30000"
        + "&onConsume=UPDATE orders.orders SET status = 'PROCESSING' WHERE id = :#id")
    .routeId("polling-consumer-sql")
    .log("Processing new order from DB: ${body[id]}")
    .marshal().json()
    .to("kafka:eip.orders.placed?brokers=localhost:9092");

// Scheduled polling with quartz (cron-based)
from("quartz:orders/nightly-export?cron=0+0+2+*+*+?")
    .routeId("polling-consumer-cron")
    .log("Starting nightly order export")
    .to("sql:SELECT * FROM orders.orders WHERE status = 'SHIPPED' "
        + "AND shipped_at > CURRENT_DATE - INTERVAL '1 day'"
        + "?dataSource=#orderDataSource")
    .split(body())
        .marshal().json()
        .to("kafka:eip.accounting.orders?brokers=localhost:9092")
    .end();
```

### Polling parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `delay` | Milliseconds between polls | 500 |
| `maxMessagesPerPoll` | Maximum messages to process per poll cycle | 0 (unlimited) |
| `greedy` | Poll again immediately if messages were found (don't wait for delay) | false |
| `sendEmptyMessageWhenIdle` | Send an empty exchange if no messages found | false |
| `scheduledExecutorService` | Custom thread pool for the polling scheduler | — |

### JBang prototyping with polling consumers

Polling consumers are ideal for JBang quick prototypes:

```bash
# Save a simple polling route
cat > file-poller.yaml << 'EOF'
- route:
    id: file-poller
    from:
      uri: "file:data/incoming?include=.*\\.csv&delay=5000"
    steps:
      - log:
          message: "Found: ${header.CamelFileName}"
      - to:
          uri: "log:processed"
EOF

# Run it
mkdir -p data/incoming
camel run file-poller.yaml --dev

# In another terminal, drop a file
echo "id,name" > data/incoming/test.csv

# camel top shows the polling activity
camel top
```

## Pattern: Event-Driven Consumer

### The problem

Kafka consumers don't poll for individual messages — the Kafka client library manages fetching and delivers messages to the consumer's processing method via callbacks. The consumer doesn't need to ask "is there a new message?" — it's notified when one arrives.

This is fundamentally different from polling: the consumer is reactive, not proactive. It consumes less CPU (no empty polls) and has lower latency (no delay between message availability and processing).

### The solution

An **Event-Driven Consumer** is activated by the messaging system when a message arrives. The consumer's processing code runs in response to a delivery notification, not a periodic check. It's the "push" model.

In Camel, most messaging component consumers (Kafka, Pulsar, JMS, AMQP, MQTT) are event-driven. The component manages the connection and thread model; your route logic runs when a message is delivered.

### How Camel models it

```java
// Kafka event-driven consumer: the Kafka client pushes messages to the route
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=inventory-service"
        + "&autoOffsetReset=earliest"
        + "&maxPollRecords=100"
        + "&consumersCount=3")
    .routeId("event-driven-consumer-kafka")
    .unmarshal().json(Map.class)
    .log("Received order ${body[order_id]}")
    .to("direct:check-inventory");

// Pulsar event-driven consumer
from("pulsar:persistent://public/default/eip.orders.placed"
        + "?subscriptionName=inventory-service"
        + "&subscriptionType=Shared"
        + "&numberOfConsumers=3")
    .routeId("event-driven-consumer-pulsar")
    .log("Received order from Pulsar")
    .to("direct:check-inventory");

// Platform HTTP event-driven consumer (REST endpoint)
from("platform-http:/api/orders?httpMethodRestrict=POST")
    .routeId("event-driven-consumer-http")
    .log("Received order via HTTP")
    .to("direct:create-order");
```

### Polling vs. event-driven in Kafka

Kafka's consumer API is technically a polling API (`consumer.poll()`), but the Camel Kafka component abstracts this into an event-driven interface: your route logic runs when `poll()` returns records. So from the Camel programmer's perspective, the Kafka consumer is event-driven — you don't manage the poll loop.

The `consumersCount` parameter controls how many threads consume from the topic. Each thread runs an independent Kafka consumer within the same consumer group. More consumers = more partitions consumed in parallel = higher throughput.

## Pattern: Competing Consumers

### The problem

Inventory-service processes orders at a rate of 100/second, but during flash sales, orders arrive at 10,000/second. A single consumer instance can't keep up. You need to scale horizontally — run multiple instances of inventory-service and distribute the workload across them.

### The solution

**Competing Consumers** run multiple consumers on the same point-to-point channel, each competing for messages. The messaging system ensures each message is delivered to exactly one consumer. Adding more consumers increases throughput linearly (up to the partition count in Kafka).

We introduced this concept in Chapter 04 (Point-to-Point Channel). Here, we focus on the practical implementation and tuning.

### How Camel models it

```java
// Multiple consumer threads within a single Camel application
from("kafka:eip.orders.placed?brokers=localhost:9092"
        + "&groupId=inventory-service"
        + "&consumersCount=3"           // 3 consumer threads
        + "&maxPollRecords=50"          // batch size per poll
        + "&autoOffsetReset=earliest")
    .routeId("competing-consumers")
    .unmarshal().json(Map.class)
    .log("Thread ${threadName}: processing order ${body[order_id]}")
    .to("direct:check-inventory");
```

### Scaling dimensions

You can scale competing consumers at two levels:

1. **Within a single application** — Increase `consumersCount` to add more consumer threads. Each thread is assigned partitions by Kafka's group coordinator. Maximum useful value = partition count of the topic.

2. **Across multiple application instances** — Deploy multiple copies of the service (via Kubernetes replicas, Podman instances, etc.). Each instance joins the same consumer group and is assigned a subset of partitions.

```
Topic: eip.orders.placed (12 partitions)

Instance 1 (consumersCount=2):
  Thread-A → P0, P1, P2
  Thread-B → P3, P4, P5

Instance 2 (consumersCount=2):
  Thread-A → P6, P7, P8
  Thread-B → P9, P10, P11

Total: 4 consumer threads across 2 instances, each processing 3 partitions.
```

Adding a third instance with `consumersCount=2` would trigger a rebalance, redistributing partitions to 2 per thread (12 partitions ÷ 6 threads).

### The partition ceiling

You can't have more active consumers than partitions. If a topic has 6 partitions and you run 8 consumer threads, 2 threads sit idle. Plan your partition count based on your expected peak concurrency.

## Pattern: Message Dispatcher

### The problem

A single Kafka consumer receives events from `eip.orders.status-updates`, but different event types need different handlers: `OrderPlaced` events go to the order creation handler, `OrderCancelled` events go to the cancellation handler, `OrderRefunded` events go to the refund handler. You could use a content-based router in every route that consumes from this topic, but that scatters the routing logic.

### The solution

A **Message Dispatcher** receives messages from a channel and distributes them to specific handlers based on the message type. It centralizes the dispatch logic in one place — a single consumer route that fans out to type-specific handler routes.

### How Camel models it

```java
// Dispatcher: single consumer, multiple handlers
from("kafka:eip.orders.status-updates?brokers=localhost:9092&groupId=order-dispatcher")
    .routeId("message-dispatcher")
    .unmarshal().json(Map.class)
    .log("Dispatching ${body[event_type]} for order ${body[order_id]}")
    .toD("direct:handle-${body[event_type]}");

// Handler routes — each handles one event type
from("direct:handle-OrderPlaced")
    .routeId("handler-order-placed")
    .log("Creating order ${body[order_id]}")
    .to("direct:create-order");

from("direct:handle-OrderCancelled")
    .routeId("handler-order-cancelled")
    .log("Cancelling order ${body[order_id]}")
    .to("direct:cancel-order");

from("direct:handle-OrderRefunded")
    .routeId("handler-order-refunded")
    .log("Processing refund for order ${body[order_id]}")
    .to("direct:process-refund");
```

### Dispatcher vs. datatype channels

The dispatcher pattern uses a single topic with type-based dispatching. Datatype channels (Chapter 04) use separate topics per type. Both are valid:

- **Datatype channels** are better when event types have different volume, retention, and partitioning requirements.
- **Dispatchers** are better when you have many event types and creating a separate topic per type is impractical.

In our shipping domain, we use datatype channels (`eip.orders.placed`, `eip.inventory.reserved`) for the core event flow and dispatchers for internal routing within a service (multiple sub-handlers for different event types on the same status-updates topic).

### Safety with `toD()`

The `toD()` (dynamic to) resolves the endpoint URI at runtime from the message body or headers. This is powerful but risky — a malicious `event_type` value could route to an unexpected endpoint. Validate the event type before dispatching:

```java
.process(exchange -> {
    String eventType = (String) exchange.getIn().getBody(Map.class).get("event_type");
    Set<String> allowed = Set.of("OrderPlaced", "OrderCancelled", "OrderRefunded", "OrderUpdated");
    if (!allowed.contains(eventType)) {
        throw new IllegalArgumentException("Unknown event type: " + eventType);
    }
})
.toD("direct:handle-${body[event_type]}");
```

## Common pitfalls

**Polling too aggressively.** A 100ms poll interval on an empty database table wastes CPU and database connections. Use longer intervals with `greedy=true` to poll rapidly only when messages are available.

**Too many competing consumers.** More consumers than partitions means wasted resources — idle threads consume memory and connections. Match `consumersCount` × instance count to your partition count.

**Event-driven consumers without backpressure.** If the consumer processes slower than messages arrive, the internal buffer grows unbounded. Use `maxPollRecords` to limit batch size and let the Kafka client pause fetching until the current batch is processed.

**Dispatchers without a fallback.** If `toD("direct:handle-${body[event_type]}")` encounters an unknown event type, the `direct:handle-UnknownType` endpoint doesn't exist and the route throws `NoSuchEndpointException`. Add a `doTry`/`doCatch` or validate the type before dispatching.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 9: "Messaging Endpoints"
- [enterpriseintegrationpatterns.com — Polling Consumer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PollingConsumer.html)
- [enterpriseintegrationpatterns.com — Event-Driven Consumer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/EventDrivenConsumer.html)
- [enterpriseintegrationpatterns.com — Competing Consumers](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CompetingConsumers.html)
- [enterpriseintegrationpatterns.com — Message Dispatcher](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageDispatcher.html)
- [Apache Camel — Polling Consumer](https://camel.apache.org/manual/polling-consumer.html)
- [Apache Camel — Kafka Component](https://camel.apache.org/components/4.20.x/kafka-component.html)

## What you learned

- **Polling Consumer** actively checks for messages at intervals — use for sources that don't support push (files, databases, FTP).
- **Event-Driven Consumer** is notified when messages arrive — lower latency, less CPU, the default for Kafka/Pulsar/JMS.
- **Competing Consumers** scale throughput by running multiple consumers on the same channel — scale within a process (`consumersCount`) and across instances (Kubernetes replicas).
- **Message Dispatcher** centralizes type-based routing from a single consumer to multiple handlers — use `toD()` for dynamic dispatch, but validate inputs.

Next: producer-side patterns, transactional messaging, and durable subscribers.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Kafka component `consumersCount` parameter controls consumer threads; `maxPollRecords` matches Kafka client `max.poll.records`; `toD()` resolves dynamic URIs at runtime; `file` component `delay`, `maxMessagesPerPoll`, `sortBy` parameters exist; `sql` component `onConsume` parameter runs after each row.*
