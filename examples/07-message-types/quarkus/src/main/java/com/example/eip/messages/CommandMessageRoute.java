package com.example.eip.messages;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Command Message pattern — a message that tells a receiver to
 * <em>do something</em>.
 *
 * A ProcessPayment command is sent point-to-point over
 * {@code eip.commands.process-payment}.  Exactly one consumer picks up
 * each command and executes it, logging the outcome.
 */
@ApplicationScoped
public class CommandMessageRoute extends RouteBuilder {

    @Override
    public void configure() {
        // ── Producer: accept command from direct endpoint, publish to Kafka ──
        from("direct:send-command")
            .routeId("command-message-producer")
            .log("Sending command → eip.commands.process-payment: ${body}")
            .to("kafka:eip.commands.process-payment?brokers={{kafka.brokers}}");

        // ── Consumer: receive and execute the command ────────────────────────
        from("kafka:eip.commands.process-payment?brokers={{kafka.brokers}}&groupId=command-processor")
            .routeId("command-message-consumer")
            .unmarshal().json()
            .log("Received command: ${body[command]} for payment ${body[payment_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                String command = (String) body.get("command");
                String paymentId = (String) body.get("payment_id");
                Number amount = (Number) body.get("amount");

                // Simulate command execution
                exchange.getIn().setHeader("commandResult", "SUCCESS");
                exchange.getIn().setBody(
                    "{\"payment_id\": \"%s\", \"status\": \"PROCESSED\", \"amount\": %.2f}"
                        .formatted(paymentId, amount.doubleValue()));
            })
            .log("Command executed: ${body}");
    }
}
