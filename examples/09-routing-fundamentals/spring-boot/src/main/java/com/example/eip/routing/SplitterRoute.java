package com.example.eip.routing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class SplitterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.batch?brokers={{kafka.brokers}}&groupId=splitter-demo")
            .routeId("order-splitter")
            .unmarshal().json()
            .log("Batch received with ${body[items].size()} items")
            .split(jsonpath("$.items[*]"))
                .log("Processing item: ${body[item_sku]} qty=${body[quantity]}")
                .marshal().json()
                .to("kafka:eip.orders.individual?brokers={{kafka.brokers}}")
            .end();
    }
}
