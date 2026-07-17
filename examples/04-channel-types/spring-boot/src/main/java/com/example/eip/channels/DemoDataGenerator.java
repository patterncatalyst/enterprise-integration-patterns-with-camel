package com.example.eip.channels;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class DemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        from("timer:demo-orders?period=5000&delay=3000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String[] statuses = {"placed", "cancelled", "refunded"};
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
                        "shipping_priority": "%s"
                    }
                    """.formatted(
                        id,
                        id % 100,
                        id,
                        (int) (1 + id % 5),
                        amount,
                        status,
                        amount > 300 ? "EXPRESS" : "STANDARD"
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} (status: ${body}) → eip.orders.placed");
    }
}
