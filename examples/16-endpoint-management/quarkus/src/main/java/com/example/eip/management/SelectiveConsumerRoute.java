package com.example.eip.management;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Selective Consumer pattern — a Kafka consumer that inspects message headers
 * and only processes messages matching a selection criterion.  Here, only
 * non-hazmat orders are accepted; hazmat orders are logged and discarded.
 */
@ApplicationScoped
public class SelectiveConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=selective-consumer-demo")
            .routeId("selective-consumer")
            .log("Selective Consumer received order — containsHazmat=${header.containsHazmat}")
            .choice()
                .when(header("containsHazmat").isEqualTo("true"))
                    .log("REJECTED — order contains hazmat, skipping")
                .otherwise()
                    .log("ACCEPTED — forwarding non-hazmat order to eip.orders.accepted")
                    .to("kafka:eip.orders.accepted?brokers={{kafka.brokers}}")
            .end();
    }
}
