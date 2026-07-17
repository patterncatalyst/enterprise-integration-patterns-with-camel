package com.example.eip.channels;

import java.util.concurrent.atomic.AtomicLong;

import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.pubsub.PubSubCommands;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;

/**
 * Redis Pub/Sub — demonstrates Redis as a messaging channel alongside
 * Kafka (point-to-point) and Pulsar (pub-sub). Redis Pub/Sub is fire-and-forget:
 * messages are NOT persisted, so subscribers only receive messages published
 * while they are connected. Good for real-time notifications where durability
 * is not required.
 */
@ApplicationScoped
public class RedisChannelRoute extends RouteBuilder {

    @Inject
    RedisDataSource redis;

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        from("timer:redis-publisher?period=8000&delay=5000")
            .routeId("redis-pubsub-publisher")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String json = """
                    {"order_id": %d, "customer_id": "CUST-%03d", "event": "status_update", "status": "SHIPPED"}
                    """.formatted(id, id % 100).strip();

                PubSubCommands<String> pubsub = redis.pubsub(String.class);
                pubsub.publish("eip.orders.notifications", json);
                exchange.getIn().setBody(json);
            })
            .log("Redis Pub/Sub → published notification: ${body}");

        from("timer:redis-subscriber-start?repeatCount=1&delay=2000")
            .routeId("redis-pubsub-subscriber")
            .process(exchange -> {
                PubSubCommands<String> pubsub = redis.pubsub(String.class);
                pubsub.subscribe("eip.orders.notifications", message ->
                    log.info("Redis Pub/Sub ← received: {}", message));
            })
            .log("Redis Pub/Sub subscriber started on channel: eip.orders.notifications");
    }
}
