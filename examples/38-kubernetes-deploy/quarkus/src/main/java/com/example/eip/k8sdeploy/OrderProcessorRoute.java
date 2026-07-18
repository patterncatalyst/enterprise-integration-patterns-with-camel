package com.example.eip.k8sdeploy;

import java.time.Duration;
import java.util.Map;

import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JsonLibrary;

@ApplicationScoped
public class OrderProcessorRoute extends RouteBuilder {

    @Inject
    RedisAPI redis;

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

        Response response = redis.get("customer:" + customerId)
            .await().atMost(Duration.ofSeconds(2));

        if (response != null) {
            order.put("customerName", response.toString());
        } else {
            order.put("customerName", "Unknown (cache miss)");
        }

        exchange.getMessage().setBody(order);
    }
}
