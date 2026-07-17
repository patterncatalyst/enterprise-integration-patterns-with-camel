package com.example.eip.consumers;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * Event-Driven Consumer — messages are pushed to the route as soon as
 * they arrive on the Kafka topic.  This is the default consumption model
 * in Camel: the {@code from("kafka:…")} endpoint continuously listens
 * and dispatches each record into the route pipeline.
 */
@Component
public class EventDrivenConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.consumer.events?brokers={{kafka.brokers}}"
                + "&groupId=event-driven-consumer&autoOffsetReset=earliest")
            .routeId("event-driven-consumer")
            .unmarshal().json()
            .log("Event-driven consumer received: order ${body[order_id]}, "
                + "type=${body[event_type]}, amount=${body[amount]}");
    }
}
