package com.example.eip.k8sdeploy;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderApiRoute extends RouteBuilder {

    @Override
    public void configure() {
        rest("/api/orders")
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
