package com.example.eip.kafka.producer;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class BatchedProducerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:batched-order-gen?period=1000")
            .routeId("batched-producer")
            .process(exchange -> {
                long orderId = 8000 + (System.nanoTime() % 200);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 50, 29.99 * (1 + orderId % 4)));
            })
            .log("Batched producer sending order")
            .to("kafka:eip.orders.batched?brokers={{kafka.brokers}}"
                + "&lingerMs=100"
                + "&bufferMemorySize=33554432"
                + "&additionalProperties[batch.size]=65536");

        from("kafka:eip.orders.batched?brokers={{kafka.brokers}}&groupId=batched-verifier")
            .routeId("batched-verifier")
            .unmarshal().json(java.util.Map.class)
            .log("Batched verifier received order ${body[order_id]} from partition ${header[kafka.PARTITION]}");
    }
}
