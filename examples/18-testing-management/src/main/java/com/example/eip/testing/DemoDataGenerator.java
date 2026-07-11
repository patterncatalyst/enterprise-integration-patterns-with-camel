package com.example.eip.testing;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:demo-orders?period=5000&delay=3000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = exchange.getIn().getHeader("CamelTimerCounter", Long.class);
                String[] statuses = {"PENDING", "CONFIRMED", "SHIPPED"};
                String status = statuses[(int) (id % statuses.length)];
                double amount = 50 + (id * 37 % 500);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-SHIP-%d",
                        "quantity": %d,
                        "amount": %.2f,
                        "status": "%s",
                        "requires_enrichment": %s,
                        "payment_method": "CREDIT_CARD"
                    }
                    """.formatted(
                        id,
                        id % 100,
                        id,
                        (int) (1 + id % 5),
                        amount,
                        status,
                        id % 3 == 0
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} -> eip.orders.placed");
    }
}
