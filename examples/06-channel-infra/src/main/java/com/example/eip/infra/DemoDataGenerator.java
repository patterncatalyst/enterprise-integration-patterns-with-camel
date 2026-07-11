package com.example.eip.infra;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:order-generator?period=5000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long orderId = exchange.getProperty("CamelTimerCounter", Long.class);
                String order = String.format(
                    "{\"order_id\": %d, \"item\": \"WIDGET-%03d\", \"quantity\": %d, \"status\": \"NEW\"}",
                    orderId, orderId % 50 + 1, (orderId % 10) + 1);
                exchange.getIn().setBody(order);
            })
            .log("Generated order ${body}")
            .to("kafka:eip.orders.incoming?brokers={{kafka.brokers}}");
    }
}
