package com.example.eip.kafka;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class PartitionedProducerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:order-generator?period=5000")
            .routeId("partitioned-producer")
            .process(exchange -> {
                long orderId = 1000 + (System.nanoTime() % 100);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"item_sku\": \"SKU-A1\", \"quantity\": %d, \"amount\": %.2f}",
                    orderId, orderId % 50, 1 + (orderId % 5), 29.99 * (1 + orderId % 3)));
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(orderId));
            })
            .log("Producing order ${header[kafka.KEY]} to partitioned topic")
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}");
    }
}
