package com.example.eip.k8sdeploy;

import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JsonLibrary;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderProcessorRoute extends RouteBuilder {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=k8s-order-processor&autoOffsetReset=earliest")
            .routeId("order-processor")
            .log("Processing order: ${body}")
            .unmarshal().json(JsonLibrary.Jackson, Map.class)
            .process(this::enrichFromCache)
            .marshal().json(JsonLibrary.Jackson)
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}")
            .log("Enriched order published: ${body}");
    }

    @SuppressWarnings("unchecked")
    private void enrichFromCache(Exchange exchange) {
        Map<String, Object> order = exchange.getMessage().getBody(Map.class);
        String customerId = (String) order.get("customerId");

        String customerName = redisTemplate.opsForValue().get("customer:" + customerId);
        if (customerName != null) {
            order.put("customerName", customerName);
        } else {
            order.put("customerName", "Unknown (cache miss)");
        }

        exchange.getMessage().setBody(order);
    }
}
