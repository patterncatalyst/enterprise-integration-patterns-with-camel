package com.example.eip.endpoints;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Transactional Client / Outbox Pattern — writes both the payment
 * record and an outbox event in a single database transaction, then
 * a separate route polls unpublished outbox events and publishes
 * them to Kafka.
 */
@ApplicationScoped
public class OutboxPatternRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Step 1: consume payment request, write payment + outbox atomically
        from("kafka:eip.payments.required?brokers={{kafka.brokers}}&groupId=payment-outbox")
            .routeId("transactional-client")
            .unmarshal().json()
            .log("Transactional Client — processing payment for order ${body[order_id]}")
            .transacted()
            .to("sql:INSERT INTO payments.payments (order_id, amount, status) "
                + "VALUES (:#${body[order_id]}, :#${body[amount]}, 'PROCESSED')")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> order = exchange.getIn().getBody(Map.class);
                Map<String, Object> event = new LinkedHashMap<>();
                String eventId = UUID.randomUUID().toString();
                event.put("event_id", eventId);
                event.put("event_type", "PaymentProcessed");
                event.put("aggregate_id", String.valueOf(order.get("order_id")));
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("order_id", order.get("order_id"));
                payload.put("amount", order.get("amount"));
                payload.put("status", "PROCESSED");
                event.put("payload", new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(payload));
                exchange.getIn().setBody(event);
            })
            .to("sql:INSERT INTO payments.outbox (event_id, event_type, aggregate_id, payload) "
                + "VALUES (:#${body[event_id]}, :#${body[event_type]}, "
                + ":#${body[aggregate_id]}, :#${body[payload]})")
            .log("Transactional Client — payment and outbox event committed");

        // Step 2: poll outbox and publish to Kafka
        from("sql:SELECT * FROM payments.outbox WHERE published = false "
                + "ORDER BY created_at LIMIT 100"
                + "?delay=5000"
                + "&onConsume=UPDATE payments.outbox SET published = true "
                + "WHERE event_id = :#event_id")
            .routeId("outbox-publisher")
            .log("Outbox Publisher — publishing event ${body[event_id]} to Kafka")
            .setBody(simple("${body[payload]}"))
            .to("kafka:eip.payments.processed?brokers={{kafka.brokers}}");
    }
}
