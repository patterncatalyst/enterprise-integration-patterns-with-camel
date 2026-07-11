package com.example.eip.infra;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Messaging Bridge pattern — connects two messaging systems so that
 * messages available on one are also available on the other.
 *
 * This example bridges from one Kafka topic to another, simulating a
 * cross-system bridge (e.g., Kafka -> Pulsar).  In a production
 * deployment the destination could be a Pulsar topic, JMS queue, or
 * any other messaging provider supported by Camel.
 */
@ApplicationScoped
public class MessagingBridgeRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=messaging-bridge")
            .routeId("messaging-bridge")
            .log("Messaging Bridge — transferring order across channel boundary: ${body}")
            .to("kafka:eip.orders.bridged?brokers={{kafka.brokers}}")
            .log("Messaging Bridge — order forwarded to bridged channel");
    }
}
