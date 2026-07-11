package com.example.eip.channels;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class PointToPointRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Point-to-Point Channel: a single consumer group ensures only one
        // consumer processes each message — competing consumers on one queue.
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=p2p-order-processor")
            .routeId("point-to-point-consumer")
            .log("P2P received order: ${header.kafka.KEY}")
            .unmarshal().json()
            .log("Processing order ${body[order_id]} — amount ${body[amount]}")
            .marshal().json()
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}")
            .log("Order ${header.kafka.KEY} → eip.orders.processed");
    }
}
