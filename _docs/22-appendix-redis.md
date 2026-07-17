---
title: "Appendix D: Redis for Integration"
order: 22
part: appendices
description: "Redis as a caching layer, idempotent store, pub/sub channel, and distributed lock for integration patterns."
duration: "20 minutes"
---

Redis appears throughout this tutorial in supporting roles: caching for Content Enrichers, idempotent message deduplication, pub/sub for lightweight messaging, and distributed locks for Competing Consumers coordination. This appendix covers each use case with Camel integration.

The code is in `examples/22-redis-integration/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/22-redis-integration/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/22-redis-integration/spring-boot
mvn spring-boot:run
```

{% include excalidraw.html file="22-appendix-redis" alt="Redis four integration roles: caching, idempotent store, pub/sub, and distributed locking" caption="Figure D.1 — Redis serves four distinct roles in integration: cache-aside enrichment, idempotent message deduplication, pub/sub notifications, and distributed locking." %}

## Redis in the shipping domain

Our Podman stack runs Redis on port 6379. In the shipping domain, Redis serves four roles:

| Role | Pattern | Example |
|------|---------|---------|
| **Cache** | Content Enricher (Ch 12) | Cache customer lookups to avoid DB hits per message |
| **Idempotent store** | Idempotent Receiver (Ch 15) | Track processed `event_id` values for deduplication |
| **Pub/Sub** | Publish-Subscribe Channel (Ch 04) | Lightweight notifications within a service |
| **Distributed lock** | Competing Consumers (Ch 14) | Ensure only one instance runs a scheduled task |

## Caching for enrichment

High-throughput enrichment routes hit the database for every message. Redis caching reduces database load:

```java
@ApplicationScoped
public class CachedCustomerEnricher {

    @Inject
    @RedisClient("default")
    io.quarkus.redis.client.RedisAPI redis;

    @Inject
    @Named("orderDataSource")
    DataSource dataSource;

    public void enrich(Exchange exchange) throws Exception {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        String customerId = (String) order.get("customer_id");
        String cacheKey = "customer:" + customerId;

        // Try cache first
        var cached = redis.get(cacheKey).await().indefinitely();
        if (cached != null) {
            Map<String, Object> customer = new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(cached.toString(), Map.class);
            order.put("customer_name", customer.get("name"));
            order.put("customer_email", customer.get("email"));
            return;
        }

        // Cache miss: query database
        try (var conn = dataSource.getConnection();
             var stmt = conn.prepareStatement(
                 "SELECT name, email FROM orders.customers WHERE customer_id = ?")) {
            stmt.setString(1, customerId);
            var rs = stmt.executeQuery();
            if (rs.next()) {
                order.put("customer_name", rs.getString("name"));
                order.put("customer_email", rs.getString("email"));
                // Cache for 10 minutes
                Map<String, String> customerData = Map.of(
                    "name", rs.getString("name"),
                    "email", rs.getString("email"));
                String json = new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(customerData);
                redis.setex(cacheKey, "600", json).await().indefinitely();
            }
        }
    }
}
```

Use in a route:

```java
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=enricher")
    .routeId("cached-enrichment")
    .unmarshal().json(Map.class)
    .bean("cachedCustomerEnricher", "enrich")
    .to("direct:process-enriched-order");
```

### Cache invalidation

The hardest problem in computer science. Options:
- **TTL-based** (shown above) — Simple, eventual consistency. Set TTL to match your staleness tolerance.
- **Event-driven invalidation** — Subscribe to customer update events and invalidate the cache. More complex but more consistent.
- **Write-through** — Update cache and DB together. Requires careful coordination.

For our domain, TTL-based caching with a 10-minute window is sufficient — customer data doesn't change frequently enough to matter.

## Idempotent message store

The `RedisIdempotentRepository` tracks processed message IDs in a Redis set:

```java
@Produces
@ApplicationScoped
@Named("redisIdempotentRepo")
public RedisIdempotentRepository redisIdempotentRepository(
        @RedisClient("default") io.quarkus.redis.client.RedisAPI redis) {
    RedisIdempotentRepository repo = new RedisIdempotentRepository(redis, "idempotent-keys");
    return repo;
}

// Use in a route
from("kafka:eip.payments.required?brokers=localhost:9092&groupId=payment-service")
    .routeId("idempotent-payment")
    .unmarshal().json(Map.class)
    .idempotentConsumer(
        simple("${body[event_id]}"),
        ref("redisIdempotentRepo"))
    .log("Processing payment for order ${body[order_id]}")
    .to("direct:process-payment");
```

### Key expiration

The idempotent repository grows over time. Set a TTL on keys to bound memory usage:

```java
// Custom repository with TTL
repo.setExpiry(Duration.ofDays(7).toSeconds());
```

Messages older than 7 days won't be deduplicated — but they also won't be replayed (Kafka's retention is also 7 days), so duplicates from that far back aren't a concern.

## Pub/Sub for lightweight messaging

Redis pub/sub is useful for intra-service notifications that don't need Kafka's durability:

```java
// Publish cache invalidation events
from("direct:invalidate-customer-cache")
    .routeId("redis-pub")
    .setHeader("CamelRedis.Channel", constant("cache-invalidation"))
    .to("spring-redis://localhost:6379?command=PUBLISH");

// Subscribe to cache invalidation
from("spring-redis://localhost:6379?command=SUBSCRIBE&channels=cache-invalidation")
    .routeId("redis-sub")
    .log("Cache invalidation received: ${body}")
    .process(exchange -> {
        String customerId = exchange.getIn().getBody(String.class);
        // Delete from local cache
    });
```

Redis pub/sub is fire-and-forget — if the subscriber is offline when the message is published, the message is lost. Use Kafka for durable messaging; use Redis pub/sub for ephemeral notifications.

## Distributed locking

When running multiple instances of a service, some operations should run on only one instance (like the nightly accounting export). Redis provides distributed locks via the `SET NX EX` pattern:

```java
from("quartz:orders/nightly-export?cron=0+0+2+*+*+?")
    .routeId("distributed-lock-example")
    .process(exchange -> {
        // Try to acquire a distributed lock
        var result = redis.set(List.of(
            "lock:nightly-export",
            "instance-" + System.getenv("HOSTNAME"),
            "NX",   // only set if not exists
            "EX",   // with expiration
            "3600"  // 1 hour
        )).await().indefinitely();
        exchange.getIn().setHeader("lockAcquired", result != null);
    })
    .filter(header("lockAcquired").isEqualTo(true))
        .log("Lock acquired — running nightly export")
        .to("direct:nightly-export")
        .process(exchange -> {
            redis.del(List.of("lock:nightly-export")).await().indefinitely();
        })
    .end();
```

This ensures that even with 3 replicas of order-service running, only one instance executes the nightly export.

## Redis configuration in Quarkus

```properties
# application.properties
quarkus.redis.hosts=redis://localhost:6379
quarkus.redis.max-pool-size=20
quarkus.redis.max-pool-waiting=50
```

---

*Verification status: <span class="status status--verified">verified</span> against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
