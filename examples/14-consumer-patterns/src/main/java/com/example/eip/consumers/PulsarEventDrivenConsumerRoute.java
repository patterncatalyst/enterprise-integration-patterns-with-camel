package com.example.eip.consumers;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Pulsar Event-Driven Consumer — push-based consumption from Pulsar
 * with a Shared subscription distributing messages across 3 consumers.
 */
@ApplicationScoped
public class PulsarEventDrivenConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("pulsar:persistent://public/default/eip.consumer.events"
                + "?subscriptionName=event-driven-consumer"
                + "&subscriptionType=Shared"
                + "&numberOfConsumers=3")
            .routeId("event-driven-consumer-pulsar")
            .log("Pulsar Event-Driven Consumer received: ${body}");
    }
}
