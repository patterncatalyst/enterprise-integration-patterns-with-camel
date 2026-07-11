package com.example.eip.observability;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Message Store — captures messages flowing through the order pipeline
 * using a Wire Tap to asynchronously persist them to PostgreSQL.
 */
@ApplicationScoped
public class MessageStoreRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=message-store-demo")
            .routeId("message-store-example")
            .wireTap("direct:store-message")
            .log("Message Store — order passing through pipeline: ${body}");

        from("direct:store-message")
            .routeId("message-store")
            .process(exchange -> {
                String messageId = exchange.getExchangeId();
                String routeId = exchange.getFromRouteId();
                String timestamp = Instant.now().toString();
                String payload = exchange.getIn().getBody(String.class);

                Map<String, Object> record = new LinkedHashMap<>();
                record.put("messageId", messageId);
                record.put("routeId", routeId);
                record.put("timestamp", timestamp);
                record.put("payload", payload != null ? payload : "");
                exchange.getIn().setHeaders(new java.util.HashMap<>(exchange.getIn().getHeaders()));
                exchange.getIn().setHeader("storeMessageId", messageId);
                exchange.getIn().setHeader("storeRouteId", routeId);
                exchange.getIn().setHeader("storeTimestamp", timestamp);
                exchange.getIn().setHeader("storePayload", payload != null ? payload : "");
            })
            .to("sql:INSERT INTO system.message_store (message_id, route_id, timestamp, payload) "
                + "VALUES (:#storeMessageId, :#storeRouteId, NOW(), :#storePayload)")
            .log("Message Store — persisted ${header.storeMessageId} to PostgreSQL");
    }
}
