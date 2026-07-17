package com.example.eip.advanced;

import java.util.concurrent.atomic.AtomicLong;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class DemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        // Generate orders for Dynamic Router and Wire Tap demos
        from("timer:demo-orders?period=5000&delay=3000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String[] countries = {"US", "CA", "GB", "DE", "JP"};
                String country = countries[(int) (id % countries.length)];
                double amount = 50 + (id * 37 % 500);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-%s-%d",
                        "quantity": %d,
                        "amount": %.2f,
                        "destination_country": "%s",
                        "shipping_priority": "%s"
                    }
                    """.formatted(
                        id,
                        id % 100,
                        country, id,
                        (int) (1 + id % 5),
                        amount,
                        country,
                        amount > 300 ? "EXPRESS" : "STANDARD"
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} -> eip.orders.placed");

        // Generate sequenced orders (deliberately out of order) for the Resequencer
        from("timer:demo-sequenced?period=3000&delay=5000")
            .routeId("demo-sequenced-generator")
            .process(exchange -> {
                long seq = counter.incrementAndGet();
                // Produce messages in scrambled order within batches of 10
                long batchBase = ((seq - 1) / 10) * 10 + 1;
                int[] scramble = {5, 2, 8, 1, 9, 3, 7, 0, 6, 4};
                long seqNum = batchBase + scramble[(int) ((seq - 1) % 10)];

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-SEQ-%d",
                        "quantity": %d,
                        "amount": %.2f
                    }
                    """.formatted(seqNum, seqNum % 100, seqNum, (int) (1 + seqNum % 5), 25.0 + seqNum * 10);
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("sequenceNumber", seqNum);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(seqNum));
            })
            .to("kafka:eip.orders.sequenced?brokers={{kafka.brokers}}")
            .log("Generated sequenced order seq=${header.sequenceNumber} -> eip.orders.sequenced");

        // Generate orders with line items for the Composed Message Processor
        from("timer:demo-composed?period=8000&delay=7000")
            .routeId("demo-composed-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                int itemCount = (int) (2 + id % 4);
                StringBuilder items = new StringBuilder("[");
                for (int i = 0; i < itemCount; i++) {
                    if (i > 0) items.append(",");
                    items.append("""
                        {"sku": "SKU-%03d", "description": "Item %d", "quantity": %d, "unit_price": %.2f}
                        """.formatted(id * 10 + i, i + 1, (int) (1 + (id + i) % 5), 9.99 + i * 5.0));
                }
                items.append("]");

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "line_items": %s
                    }
                    """.formatted(id, id % 100, items.toString());
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.composed?brokers={{kafka.brokers}}")
            .log("Generated composed order ${header.kafka.KEY} with line items -> eip.orders.composed");

        // Generate orders for the Load Balancer
        from("timer:demo-loadbalanced?period=2000&delay=6000")
            .routeId("demo-loadbalanced-generator")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "SKU-LB-%d",
                        "quantity": %d,
                        "amount": %.2f
                    }
                    """.formatted(id, id % 100, id, (int) (1 + id % 5), 20.0 + id * 15);
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.orders.loadbalanced?brokers={{kafka.brokers}}")
            .log("Generated load-balanced order ${header.kafka.KEY} -> eip.orders.loadbalanced");
    }
}
