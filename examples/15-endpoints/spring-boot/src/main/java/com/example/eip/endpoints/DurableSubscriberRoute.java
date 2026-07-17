package com.example.eip.endpoints;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * Durable Subscriber — Pulsar maintains subscription state (cursor)
 * even when this consumer is offline.  On reconnect, consumption
 * resumes from the last acknowledged message.
 */
@Component
public class DurableSubscriberRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("pulsar:persistent://public/default/eip.orders.placed"
                + "?subscriptionName=notification-service"
                + "&subscriptionType=Shared"
                + "&ackTimeoutMillis=30000")
            .routeId("durable-subscriber-pulsar")
            .log("Durable Subscriber [Pulsar] — received order: ${body}");
    }
}
