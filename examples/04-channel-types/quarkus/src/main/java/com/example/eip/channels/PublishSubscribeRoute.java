package com.example.eip.channels;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class PublishSubscribeRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Publisher: forward processed orders to the shared events topic.
        from("kafka:eip.orders.processed?brokers={{kafka.brokers}}&groupId=pubsub-publisher")
            .routeId("pubsub-publisher")
            .log("Publishing order event ${header.kafka.KEY} → eip.orders.events")
            .to("kafka:eip.orders.events?brokers={{kafka.brokers}}");

        // Subscriber 1 — Inventory: each subscriber uses a DIFFERENT consumer
        // group so every subscriber receives every message (pub/sub fan-out).
        from("kafka:eip.orders.events?brokers={{kafka.brokers}}&groupId=subscriber-inventory")
            .routeId("pubsub-subscriber-inventory")
            .log("Inventory subscriber received order ${header.kafka.KEY}")
            .unmarshal().json()
            .log("Reserving stock for SKU ${body[item_sku]}, qty ${body[quantity]}");

        // Subscriber 2 — Notification
        from("kafka:eip.orders.events?brokers={{kafka.brokers}}&groupId=subscriber-notification")
            .routeId("pubsub-subscriber-notification")
            .log("Notification subscriber received order ${header.kafka.KEY}")
            .unmarshal().json()
            .log("Sending confirmation email for order ${body[order_id]}");

        // Subscriber 3 — Analytics
        from("kafka:eip.orders.events?brokers={{kafka.brokers}}&groupId=subscriber-analytics")
            .routeId("pubsub-subscriber-analytics")
            .log("Analytics subscriber received order ${header.kafka.KEY}")
            .unmarshal().json()
            .log("Recording analytics — order ${body[order_id]}, amount ${body[amount]}");
    }
}
