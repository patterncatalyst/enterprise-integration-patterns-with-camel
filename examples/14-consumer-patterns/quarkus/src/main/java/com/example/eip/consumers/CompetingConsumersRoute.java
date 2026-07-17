package com.example.eip.consumers;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Competing Consumers — multiple consumer threads process messages
 * from the same Kafka topic in parallel.  Setting {@code consumersCount=3}
 * creates three threads within this application instance, each assigned
 * a subset of partitions by the Kafka consumer group protocol.
 */
@ApplicationScoped
public class CompetingConsumersRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.consumer.compete?brokers={{kafka.brokers}}"
                + "&groupId=competing-consumers&autoOffsetReset=earliest"
                + "&consumersCount=3")
            .routeId("competing-consumers")
            .unmarshal().json()
            .log("Competing consumer [thread=${threadName}] processing: "
                + "order ${body[order_id]}, type=${body[event_type]}");
    }
}
