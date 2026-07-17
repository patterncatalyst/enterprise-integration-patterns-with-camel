package com.example.eip.metadata;

import org.springframework.stereotype.Component;
import org.apache.camel.builder.RouteBuilder;

@Component
public class FormatIndicatorRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Producer: sets a contentType header so consumers know how to unmarshal
        from("kafka:eip.metadata.orders?brokers={{kafka.brokers}}&groupId=format-producer")
            .routeId("format-indicator-producer")
            .setHeader("contentType", constant("application/json"))
            .setHeader("schemaVersion", constant("1.0"))
            .log("Tagged message with contentType=${header.contentType}, schemaVersion=${header.schemaVersion}")
            .to("kafka:eip.metadata.orders.tagged?brokers={{kafka.brokers}}");

        // Consumer: inspects the format indicator header and routes accordingly
        from("kafka:eip.metadata.orders.tagged?brokers={{kafka.brokers}}&groupId=format-consumer")
            .routeId("format-indicator-consumer")
            .log("Received message — contentType=${header.contentType}, schemaVersion=${header.schemaVersion}")
            .choice()
                .when(header("contentType").isEqualTo("application/json"))
                    .unmarshal().json()
                    .log("JSON format detected — order ${body[order_id]} deserialized successfully")
                    .marshal().json()
                    .to("kafka:eip.metadata.orders.processed?brokers={{kafka.brokers}}")
                .when(header("contentType").isEqualTo("application/xml"))
                    .log("XML format detected — would unmarshal with JAXB (not shown)")
                    .to("kafka:eip.metadata.orders.processed?brokers={{kafka.brokers}}")
                .otherwise()
                    .log("Unknown format '${header.contentType}' — routing to dead letter")
                    .to("kafka:eip.metadata.orders.dead?brokers={{kafka.brokers}}")
            .end();
    }
}
