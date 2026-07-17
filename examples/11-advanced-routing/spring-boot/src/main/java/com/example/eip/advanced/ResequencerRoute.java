package com.example.eip.advanced;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class ResequencerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.sequenced?brokers={{kafka.brokers}}&groupId=resequencer-demo")
            .routeId("batch-resequencer")
            .unmarshal().json()
            .log("Received out-of-order message seq=${header.sequenceNumber}")
            .resequence(header("sequenceNumber"))
                .batch()
                .size(10)
                .timeout(5000)
            .log("Resequenced message seq=${header.sequenceNumber}, order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.resequenced?brokers={{kafka.brokers}}");
    }
}
