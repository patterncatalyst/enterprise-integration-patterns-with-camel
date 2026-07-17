package com.example.eip.redis;

import java.time.Duration;
import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class CachingEnricherRoute extends RouteBuilder {

    @Autowired
    StringRedisTemplate redisTemplate;

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=redis-enricher")
            .routeId("cached-enrichment")
            .unmarshal().json(Map.class)
            .process(this::enrichFromCache)
            .log("Enriched order ${body[order_id]}: customer=${body[customer_name]}")
            .marshal().json()
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}");
    }

    private void enrichFromCache(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        String customerId = String.valueOf(order.get("customer_id"));
        String cacheKey = "customer:" + customerId;

        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            order.put("customer_name", cached);
            order.put("cache_hit", true);
            return;
        }

        // Simulate DB lookup
        String customerName = "Customer " + customerId;
        order.put("customer_name", customerName);
        order.put("cache_hit", false);

        // Cache for 10 minutes
        redisTemplate.opsForValue().set(cacheKey, customerName, Duration.ofSeconds(600));
    }
}
