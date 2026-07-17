package com.example.eip.testing;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderFilterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("direct:filter-order")
            .routeId("order-filter")
            .unmarshal().json(java.util.Map.class)
            .filter().simple("${body[amount]} >= 100")
                .log("High-value order ${body[order_id]}: $${body[amount]}")
                .to("direct:high-value-orders")
            .end();

        from("direct:high-value-orders")
            .routeId("high-value-handler")
            .log("High-value order received for priority processing");

        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=filter-service")
            .routeId("kafka-order-filter")
            .to("direct:filter-order");
    }
}
