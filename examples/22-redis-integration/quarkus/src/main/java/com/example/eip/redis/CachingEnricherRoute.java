package com.example.eip.redis;

import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

import java.util.List;
import java.util.Map;

@ApplicationScoped
public class CachingEnricherRoute extends RouteBuilder {

    @Inject
    RedisAPI redis;

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

        Response cached = redis.get(cacheKey).await().indefinitely();
        if (cached != null) {
            order.put("customer_name", cached.toString());
            order.put("cache_hit", true);
            return;
        }

        // Simulate DB lookup
        String customerName = "Customer " + customerId;
        order.put("customer_name", customerName);
        order.put("cache_hit", false);

        // Cache for 10 minutes
        redis.setex(cacheKey, "600", customerName).await().indefinitely();
    }
}
