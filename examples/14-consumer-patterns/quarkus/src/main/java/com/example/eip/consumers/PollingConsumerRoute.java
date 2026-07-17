package com.example.eip.consumers;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Polling Consumer — pulls messages on demand rather than being
 * event-driven.  A timer fires every 10 seconds and uses
 * {@code pollEnrich} to grab the next available message from Kafka.
 * If no message is ready within the timeout the exchange body stays null.
 */
@ApplicationScoped
public class PollingConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:poll-trigger?period=10000&delay=5000")
            .routeId("polling-consumer")
            .log("Polling consumer triggered — checking for messages …")
            .pollEnrich("kafka:eip.consumer.poll?brokers={{kafka.brokers}}"
                + "&groupId=polling-consumer&autoOffsetReset=earliest", 5000)
            .choice()
                .when(body().isNull())
                    .log("No message available during this poll cycle")
                .otherwise()
                    .unmarshal().json()
                    .log("Polled message: order ${body[order_id]}, type=${body[event_type]}")
            .end();
    }
}
