package com.example.eip.pulsar;

import org.springframework.stereotype.Component;
import org.apache.camel.builder.RouteBuilder;

@Component
public class KeySharedRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:keyed-order-gen?period=4000")
            .routeId("pulsar-keyed-producer")
            .process(exchange -> {
                long orderId = 3000 + (System.nanoTime() % 50);
                String key = "order-" + orderId;
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"item_sku\": \"SKU-P2\", \"quantity\": %d, \"status\": \"placed\"}",
                    orderId, orderId % 30, 1 + (orderId % 4)));
                exchange.getIn().setHeader("pulsar.producer.message.key", key);
            })
            .log("Publishing keyed order [${header[pulsar.producer.message.key]}] to Pulsar")
            .to("pulsar:persistent://public/default/eip.orders.keyed?producerName=keyed-order-producer");

        from("pulsar:persistent://public/default/eip.orders.keyed"
                + "?subscriptionName=shipping-service"
                + "&subscriptionType=Key_Shared"
                + "&numberOfConsumers=2")
            .routeId("pulsar-key-shared-consumer")
            .log("Key_Shared consumer received order [key=${header[pulsar.producer.message.key]}]: ${body}")
            .to("direct:process-keyed-order");

        from("direct:process-keyed-order")
            .routeId("pulsar-keyed-order-processor")
            .unmarshal().json()
            .log("Processing keyed order ${body[order_id]} for customer ${body[customer_id]}")
            .log("All events for the same order key route to the same consumer instance");
    }
}
