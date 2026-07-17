package com.example.eip.pulsar;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DeadLetterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:dlt-order-gen?period=6000")
            .routeId("pulsar-dlt-producer")
            .process(exchange -> {
                long orderId = 4000 + (System.nanoTime() % 100);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"item_sku\": \"SKU-P3\", \"quantity\": %d, \"amount\": %.2f}",
                    orderId, orderId % 40, 1 + (orderId % 3), 19.99 * (1 + orderId % 5)));
            })
            .log("Publishing order to DLT-enabled topic")
            .to("pulsar:persistent://public/default/eip.orders.payments?producerName=dlt-order-producer");

        from("pulsar:persistent://public/default/eip.orders.payments"
                + "?subscriptionName=payment-service"
                + "&subscriptionType=Shared"
                + "&maxRedeliverCount=3"
                + "&deadLetterTopic=persistent://public/default/eip.orders.payments-dlq"
                + "&numberOfConsumers=1")
            .routeId("pulsar-dlt-consumer")
            .log("Processing payment order: ${body}")
            .process(exchange -> {
                String body = exchange.getIn().getBody(String.class);
                if (body.contains("\"quantity\": 1,")) {
                    throw new RuntimeException(
                        "Simulated payment failure for single-item order");
                }
            })
            .log("Payment order processed successfully");

        from("pulsar:persistent://public/default/eip.orders.payments-dlq"
                + "?subscriptionName=dlt-monitor"
                + "&subscriptionType=Exclusive")
            .routeId("pulsar-dlt-monitor")
            .log("Dead letter topic received failed order: ${body}")
            .log("Order exhausted all redelivery attempts and requires manual review");
    }
}
