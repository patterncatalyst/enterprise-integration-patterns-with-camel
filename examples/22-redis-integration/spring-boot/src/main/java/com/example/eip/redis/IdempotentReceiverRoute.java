package com.example.eip.redis;

import java.time.Duration;
import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class IdempotentReceiverRoute extends RouteBuilder {

    @Autowired
    StringRedisTemplate redisTemplate;

    @Override
    public void configure() {
        from("kafka:eip.orders.payments?brokers={{kafka.brokers}}&groupId=redis-idempotent")
            .routeId("idempotent-receiver")
            .unmarshal().json(Map.class)
            .process(this::deduplicateAndProcess)
            .choice()
                .when(header("CamelDuplicate").isEqualTo(true))
                    .log("Duplicate payment event ${body[event_id]} -- skipping")
                .otherwise()
                    .log("Processing payment event ${body[event_id]} for order ${body[order_id]}")
                    .marshal().json()
                    .to("kafka:eip.orders.payment-confirmed?brokers={{kafka.brokers}}")
            .end();
    }

    private void deduplicateAndProcess(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> event = exchange.getIn().getBody(Map.class);
        String eventId = String.valueOf(event.get("event_id"));
        String dedupeKey = "idempotent:" + eventId;

        // SET NX with a 24-hour TTL -- returns false if the key already exists
        Boolean wasSet = redisTemplate.opsForValue()
            .setIfAbsent(dedupeKey, "1", Duration.ofSeconds(86400));

        boolean isDuplicate = !Boolean.TRUE.equals(wasSet);
        exchange.getIn().setHeader("CamelDuplicate", isDuplicate);
    }
}
