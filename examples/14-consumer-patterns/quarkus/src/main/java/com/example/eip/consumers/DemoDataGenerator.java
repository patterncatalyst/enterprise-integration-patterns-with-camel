package com.example.eip.consumers;

import java.util.concurrent.atomic.AtomicLong;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        from("timer:demo-orders?period=3000&delay=2000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String[] eventTypes = {"order_placed", "order_cancelled", "order_refunded"};
                String eventType = eventTypes[(int) (id % eventTypes.length)];
                double amount = 25 + (id * 41 % 475);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "event_type": "%s",
                        "amount": %.2f,
                        "item_sku": "SKU-%04d",
                        "quantity": %d
                    }
                    """.formatted(
                        id,
                        id % 100,
                        eventType,
                        amount,
                        id % 9999,
                        (int) (1 + id % 5)
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.consumer.orders?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} → eip.consumer.orders");

        // Insert demo orders into PostgreSQL for the SQL polling consumer
        from("timer:demo-db-orders?period=30000&delay=10000")
            .routeId("demo-db-inserter")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                double amount = 25 + (id * 41 % 475);
                exchange.getIn().setHeader("customerId", "CUST-%03d".formatted(id % 100));
                exchange.getIn().setHeader("itemSku", "SKU-%04d".formatted(id % 9999));
                exchange.getIn().setHeader("quantity", (int) (1 + id % 5));
                exchange.getIn().setHeader("amount", amount);
            })
            .to("sql:INSERT INTO orders.orders (customer_id, item_sku, quantity, amount) "
                + "VALUES (:#customerId, :#itemSku, :#quantity, :#amount)")
            .log("Inserted demo order into PostgreSQL for SQL polling consumer");
    }
}
