package com.example.eip.infra;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Messaging Bridge pattern — connects two messaging systems so that
 * messages available on one are also available on the other.
 *
 * This example bridges bidirectionally between Kafka and Pulsar:
 * orders flow from Pulsar into Kafka, and shipping events flow
 * from Kafka into Pulsar.
 */
@ApplicationScoped
public class MessagingBridgeRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Pulsar → Kafka: partner orders arrive on Pulsar, bridged into Kafka
        from("pulsar:persistent://public/default/partner.orders.placed"
                + "?subscriptionName=kafka-bridge"
                + "&subscriptionType=Exclusive")
            .routeId("messaging-bridge-pulsar-to-kafka")
            .log("Messaging Bridge — Pulsar → Kafka: ${body}")
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Messaging Bridge — order forwarded to Kafka");

        // Kafka → Pulsar: shipping events bridged to Pulsar for partner systems
        from("kafka:eip.shipping.scheduled?brokers={{kafka.brokers}}&groupId=pulsar-bridge")
            .routeId("messaging-bridge-kafka-to-pulsar")
            .log("Messaging Bridge — Kafka → Pulsar: ${body}")
            .to("pulsar:persistent://public/default/eip.shipping.scheduled"
                + "?producerName=kafka-bridge")
            .log("Messaging Bridge — shipping event forwarded to Pulsar");
    }
}
