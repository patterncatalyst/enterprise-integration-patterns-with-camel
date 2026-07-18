package com.example.eip.k8sdeploy;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class OrderApiRoute extends RouteBuilder {

    @Override
    public void configure() {
        rest("/orders")
            .post()
            .consumes("application/json")
            .produces("application/json")
            .to("direct:order-entry");

        from("direct:order-entry")
            .routeId("order-api")
            .log("Received order: ${body}")
            .to("kafka:eip.orders.incoming?brokers={{kafka.brokers}}")
            .setBody(constant("{\"status\":\"accepted\"}"))
            .log("Order accepted and published to Kafka");
    }
}
