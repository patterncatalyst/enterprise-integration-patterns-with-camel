package com.example.eip.messages;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Event Message pattern — a notification that <em>something happened</em>.
 *
 * An event envelope containing {@code event_type}, {@code event_id},
 * {@code event_time}, {@code source}, and {@code data} is published to
 * {@code eip.events.orders}.  The consumer logs the event — it does not
 * return a result and the producer has no expectation of any action.
 */
@ApplicationScoped
public class EventMessageRoute extends RouteBuilder {

    @Override
    public void configure() {
        // ── Producer: accept event from direct endpoint, publish to Kafka ──
        from("direct:send-event")
            .routeId("event-message-producer")
            .log("Sending event → eip.events.orders: ${body}")
            .to("kafka:eip.events.orders?brokers={{kafka.brokers}}");

        // ── Consumer: receive and log the event ─────────────────────────────
        from("kafka:eip.events.orders?brokers={{kafka.brokers}}&groupId=event-consumer")
            .routeId("event-message-consumer")
            .unmarshal().json()
            .log("Received event: type=${body[event_type]}, "
                + "id=${body[event_id]}, "
                + "time=${body[event_time]}, "
                + "source=${body[source]}")
            .log("Event data: ${body[data]}");
    }
}
