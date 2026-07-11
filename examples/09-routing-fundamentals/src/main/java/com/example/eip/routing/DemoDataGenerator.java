package com.example.eip.routing;

import java.util.concurrent.atomic.AtomicLong;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        from("timer:demo-orders?period=5000&delay=3000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String[] countries = {"US", "CA", "GB", "DE", "JP"};
                String country = countries[(int) (id % countries.length)];
                boolean hazmat = id % 7 == 0;
                double amount = 50 + (id * 37 % 500);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-%s-%d",
                        "quantity": %d,
                        "amount": %.2f,
                        "destination_country": "%s",
                        "contains_hazmat": %s,
                        "shipping_priority": "%s"
                    }
                    """.formatted(
                        id,
                        id % 100,
                        country, id,
                        (int) (1 + id % 5),
                        amount,
                        country,
                        hazmat,
                        amount > 300 ? "EXPRESS" : "STANDARD"
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} → eip.orders.placed");
    }
}
