package com.example.eip.management;

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
                String[] countries = {"US", "CA", "GB", "DE", "JP"};
                String country = countries[(int) (id % countries.length)];
                boolean hazmat = id % 3 == 0;
                double amount = 50 + (id * 37 % 500);
                long timestamp = System.currentTimeMillis();

                // Stagger timestamps: every 4th order gets a stale timestamp (1 hour old)
                // to exercise the channel purger
                if (id % 4 == 0) {
                    timestamp = timestamp - 3_600_000;
                }

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-%s-%d",
                        "quantity": %d,
                        "amount": %.2f,
                        "destination_country": "%s",
                        "contains_hazmat": %s,
                        "shipping_priority": "%s",
                        "timestamp": %d
                    }
                    """.formatted(
                        id,
                        id % 100,
                        country, id,
                        (int) (1 + id % 5),
                        amount,
                        country,
                        hazmat,
                        amount > 300 ? "EXPRESS" : "STANDARD",
                        timestamp
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
                exchange.getIn().setHeader("containsHazmat", hazmat);
                exchange.getIn().setHeader("orderTimestamp", timestamp);
            })
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} (hazmat=${header.containsHazmat}) → eip.orders.placed");
    }
}
