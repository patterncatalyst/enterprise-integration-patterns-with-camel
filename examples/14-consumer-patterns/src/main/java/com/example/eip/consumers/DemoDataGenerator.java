package com.example.eip.consumers;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:demo-orders?period=3000&delay=2000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = exchange.getIn().getHeader("CamelTimerCounter", Long.class);
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
            .log("Generated order ${header.kafka.KEY} (${body}) → eip.consumer.orders");
    }
}
