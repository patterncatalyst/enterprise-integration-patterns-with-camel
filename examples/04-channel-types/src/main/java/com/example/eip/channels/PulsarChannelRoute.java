package com.example.eip.channels;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class PulsarChannelRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Point-to-Point on Pulsar: Shared subscription distributes
        // messages round-robin across consumers (same as Kafka consumer group)
        from("pulsar:persistent://public/default/eip.orders.placed"
                + "?subscriptionName=pulsar-p2p-processor"
                + "&subscriptionType=Shared")
            .routeId("point-to-point-pulsar")
            .log("Pulsar P2P received order: ${body}");

        // Publish-Subscribe on Pulsar: each Exclusive subscription
        // receives every message independently (fan-out)
        from("pulsar:persistent://public/default/eip.orders.events"
                + "?subscriptionName=subscriber-inventory"
                + "&subscriptionType=Exclusive")
            .routeId("pubsub-pulsar-inventory")
            .log("Pulsar Pub/Sub [inventory] received: ${body}");

        from("pulsar:persistent://public/default/eip.orders.events"
                + "?subscriptionName=subscriber-notification"
                + "&subscriptionType=Exclusive")
            .routeId("pubsub-pulsar-notification")
            .log("Pulsar Pub/Sub [notification] received: ${body}");

        from("pulsar:persistent://public/default/eip.orders.events"
                + "?subscriptionName=subscriber-analytics"
                + "&subscriptionType=Exclusive")
            .routeId("pubsub-pulsar-analytics")
            .log("Pulsar Pub/Sub [analytics] received: ${body}");
    }
}
