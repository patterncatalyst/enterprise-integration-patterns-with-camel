package com.example.eip.routing;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class MessageFilterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=filter-demo")
            .routeId("message-filter")
            .unmarshal().json()
            .filter(simple("${body[amount]} >= 100"))
                .log("High-value order ${body[order_id]}: $${body[amount]}")
                .to("kafka:eip.orders.high-value?brokers={{kafka.brokers}}")
            .end();
    }
}
