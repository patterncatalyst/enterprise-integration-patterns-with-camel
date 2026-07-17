package com.example.eip.channels;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class PulsarDemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        from("timer:demo-pulsar-orders?period=5000&delay=4000")
            .routeId("demo-data-generator-pulsar")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                double amount = 50 + (id * 43 % 500);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-PULSAR-%d",
                        "quantity": %d,
                        "amount": %.2f,
                        "status": "placed",
                        "shipping_priority": "%s"
                    }
                    """.formatted(
                        1000 + id,
                        id % 100,
                        id,
                        (int) (1 + id % 5),
                        amount,
                        amount > 300 ? "EXPRESS" : "STANDARD"
                    );
                exchange.getIn().setBody(json);
            })
            .multicast()
                .to("pulsar:persistent://public/default/eip.orders.placed?producerName=demo-p2p")
                .to("pulsar:persistent://public/default/eip.orders.events?producerName=demo-pubsub")
            .end()
            .log("Generated Pulsar order → eip.orders.placed + eip.orders.events");
    }
}
