package com.example.eip.channels;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

/**
 * Redis Pub/Sub — demonstrates Redis as a messaging channel alongside
 * Kafka (point-to-point) and Pulsar (pub-sub). Redis Pub/Sub is fire-and-forget:
 * messages are NOT persisted, so subscribers only receive messages published
 * while they are connected. Good for real-time notifications where durability
 * is not required.
 */
@Component
public class RedisChannelRoute extends RouteBuilder {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private RedisMessageListenerContainer redisListenerContainer;

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

                redisTemplate.convertAndSend("eip.orders.notifications", json);
                exchange.getIn().setBody(json);
            })
            .log("Redis Pub/Sub → published notification: ${body}");

        from("timer:redis-subscriber-start?repeatCount=1&delay=2000")
            .routeId("redis-pubsub-subscriber")
            .process(exchange -> {
                MessageListener listener = (Message message, byte[] pattern) ->
                    log.info("Redis Pub/Sub ← received: {}", new String(message.getBody()));
                redisListenerContainer.addMessageListener(listener,
                    new ChannelTopic("eip.orders.notifications"));
            })
            .log("Redis Pub/Sub subscriber started on channel: eip.orders.notifications");
    }
}
