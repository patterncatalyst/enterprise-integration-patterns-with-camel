package com.example.eip.kafka.producer;

import org.springframework.stereotype.Component;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

@Component
public class SynchronousProducerRoute extends RouteBuilder {

    @Override
    public void configure() {
        onException(Exception.class)
            .handled(true)
            .log("Producer error for order: ${body} — ${exception.message}")
            .to("direct:producer-error-handler");

        from("timer:sync-order-gen?period=6000")
            .routeId("synchronous-producer")
            .process(exchange -> {
                long orderId = 11000 + (System.nanoTime() % 50);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 25, 299.99));
            })
            .log("Synchronous producer sending order (blocks until ack)")
            .to("kafka:eip.orders.sync?brokers={{kafka.brokers}}"
                + "&requestRequiredAcks=all"
                + "&synchronous=true")
            .log("Synchronous producer confirmed: partition=${header[kafka.PARTITION]} offset=${header[kafka.OFFSET]}");

        from("direct:producer-error-handler")
            .routeId("producer-error-handler")
            .log("Error handler: would store failed message for retry or dead letter");
    }
}
