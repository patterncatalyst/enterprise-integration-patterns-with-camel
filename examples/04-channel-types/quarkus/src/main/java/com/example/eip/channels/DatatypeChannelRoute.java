package com.example.eip.channels;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DatatypeChannelRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Datatype Channel: route each event type to its own dedicated topic.
        // A single inbound stream is split by type so that downstream consumers
        // subscribe only to the event type they care about.
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=datatype-router")
            .routeId("datatype-channel-router")
            .unmarshal().json()
            .log("Routing order ${body[order_id]} with status '${body[status]}'")
            .choice()
                .when().simple("${body[status]} == 'placed'")
                    .marshal().json()
                    .to("kafka:eip.orders.placed.typed?brokers={{kafka.brokers}}")
                    .log("→ eip.orders.placed.typed")
                .when().simple("${body[status]} == 'cancelled'")
                    .marshal().json()
                    .to("kafka:eip.orders.cancelled?brokers={{kafka.brokers}}")
                    .log("→ eip.orders.cancelled")
                .when().simple("${body[status]} == 'refunded'")
                    .marshal().json()
                    .to("kafka:eip.orders.refunded?brokers={{kafka.brokers}}")
                    .log("→ eip.orders.refunded")
                .otherwise()
                    .marshal().json()
                    .to("kafka:eip.orders.unknown?brokers={{kafka.brokers}}")
                    .log("→ eip.orders.unknown (unrecognised status)")
            .end();

        // Dedicated consumers for each datatype channel
        from("kafka:eip.orders.placed.typed?brokers={{kafka.brokers}}&groupId=datatype-placed")
            .routeId("datatype-channel-placed")
            .log("Placed-channel consumer received: ${header.kafka.KEY}");

        from("kafka:eip.orders.cancelled?brokers={{kafka.brokers}}&groupId=datatype-cancelled")
            .routeId("datatype-channel-cancelled")
            .log("Cancelled-channel consumer received: ${header.kafka.KEY}");

        from("kafka:eip.orders.refunded?brokers={{kafka.brokers}}&groupId=datatype-refunded")
            .routeId("datatype-channel-refunded")
            .log("Refunded-channel consumer received: ${header.kafka.KEY}");
    }
}
