package com.example.eip.infra;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Message Bus pattern — a shared messaging infrastructure that
 * multiple applications connect to for loosely-coupled communication.
 *
 * Kafka acts as the message bus.  Multiple independent consumers
 * (each with its own consumer group) subscribe to the same topics,
 * demonstrating how the bus decouples producers from consumers.
 */
@ApplicationScoped
public class MessageBusRoute extends RouteBuilder {

    @Override
    public void configure() {
        // --- Inventory service: reacts to incoming orders ---
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=bus-inventory-service")
            .routeId("message-bus-inventory")
            .log("Message Bus [inventory-service] — reserving stock for order: ${body}");

        // --- Payment service: reacts to the same incoming orders ---
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=bus-payment-service")
            .routeId("message-bus-payment")
            .log("Message Bus [payment-service] — initiating payment for order: ${body}");

        // --- Notification service: reacts to the same incoming orders ---
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=bus-notification-service")
            .routeId("message-bus-notification")
            .log("Message Bus [notification-service] — sending confirmation for order: ${body}");

        // --- Fulfillment service: listens to bridged orders and marks them fulfilled ---
        from("kafka:eip.orders.bridged?brokers={{kafka.brokers}}&groupId=bus-fulfillment-service")
            .routeId("message-bus-fulfillment")
            .log("Message Bus [fulfillment-service] — fulfilling bridged order: ${body}")
            .to("kafka:eip.orders.fulfilled?brokers={{kafka.brokers}}");
    }
}
