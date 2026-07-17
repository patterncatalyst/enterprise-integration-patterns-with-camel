package com.example.eip.pulsar;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class SharedSubscriptionRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:pulsar-order-gen?period=5000")
            .routeId("pulsar-order-producer")
            .process(exchange -> {
                long orderId = 2000 + (System.nanoTime() % 100);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"item_sku\": \"SKU-P1\", \"quantity\": %d, \"amount\": %.2f}",
                    orderId, orderId % 50, 1 + (orderId % 5), 49.99 * (1 + orderId % 3)));
            })
            .log("Publishing order to Pulsar")
            .to("pulsar:persistent://public/default/eip.orders.placed?producerName=order-producer");

        from("pulsar:persistent://public/default/eip.orders.placed"
                + "?subscriptionName=inventory-service"
                + "&subscriptionType=Shared"
                + "&numberOfConsumers=2")
            .routeId("pulsar-shared-consumer")
            .log("Shared consumer received: ${body}")
            .to("direct:process-pulsar-order");

        from("direct:process-pulsar-order")
            .routeId("pulsar-order-processor")
            .log("Processing Pulsar order");
    }
}
