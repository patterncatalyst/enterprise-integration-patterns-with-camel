package com.example.eip.kafka.producer;

import org.springframework.stereotype.Component;

import org.apache.camel.builder.RouteBuilder;

@Component
public class IdempotentProducerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:idempotent-order-gen?period=5000")
            .routeId("idempotent-producer")
            .process(exchange -> {
                long orderId = 10000 + (System.nanoTime() % 50);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 20, 149.99));
            })
            .log("Idempotent producer sending order (exactly-once semantics)")
            .to("kafka:eip.orders.idempotent?brokers={{kafka.brokers}}"
                + "&additionalProperties[enable.idempotence]=true"
                + "&requestRequiredAcks=all"
                + "&retries=2147483647");

        from("kafka:eip.orders.idempotent?brokers={{kafka.brokers}}&groupId=idempotent-verifier")
            .routeId("idempotent-verifier")
            .unmarshal().json(java.util.Map.class)
            .log("Idempotent verifier: order ${body[order_id]} — no duplicates even with retries");
    }
}
