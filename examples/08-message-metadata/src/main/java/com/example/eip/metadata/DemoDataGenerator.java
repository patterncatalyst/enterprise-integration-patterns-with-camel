package com.example.eip.metadata;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DemoDataGenerator extends RouteBuilder {

    @Override
    public void configure() {
        // Generates individual orders for correlation-id and expiration demos
        from("timer:metadata-orders?period=5000&delay=3000")
            .routeId("demo-data-generator")
            .process(exchange -> {
                long id = exchange.getIn().getHeader("CamelTimerCounter", Long.class);
                String[] skus = {"WIDGET-A", "GADGET-B", "SENSOR-C", "MOTOR-D", "VALVE-E"};
                String sku = skus[(int) (id % skus.length)];
                double amount = 25 + (id * 41 % 475);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "item_sku": "%s",
                        "quantity": %d,
                        "amount": %.2f,
                        "destination_country": "%s"
                    }
                    """.formatted(
                        id,
                        id % 100,
                        sku,
                        (int) (1 + id % 10),
                        amount,
                        id % 3 == 0 ? "GB" : "US"
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("kafka:eip.metadata.orders?brokers={{kafka.brokers}}")
            .log("Generated order ${header.kafka.KEY} -> eip.metadata.orders");

        // Generates bulk orders for the message-sequence (splitter/aggregator) demo
        from("timer:metadata-bulk?period=15000&delay=6000")
            .routeId("demo-bulk-generator")
            .process(exchange -> {
                long batch = exchange.getIn().getHeader("CamelTimerCounter", Long.class);
                int itemCount = (int) (3 + batch % 4); // 3-6 items per bulk order

                StringBuilder items = new StringBuilder();
                for (int i = 0; i < itemCount; i++) {
                    if (i > 0) items.append(",");
                    items.append("""
                        {
                            "line_number": %d,
                            "item_sku": "PART-%c%d",
                            "quantity": %d,
                            "unit_price": %.2f
                        }
                        """.formatted(
                            i + 1,
                            (char) ('A' + (i % 26)),
                            batch * 10 + i,
                            1 + (i + batch) % 8,
                            10.0 + (i * 13 % 90)
                        ));
                }

                String json = """
                    {
                        "bulk_order_id": "BULK-%03d",
                        "customer_id": "CUST-%03d",
                        "items": [%s]
                    }
                    """.formatted(batch, batch % 50, items.toString());

                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", "BULK-" + batch);
            })
            .to("kafka:eip.metadata.bulk-orders?brokers={{kafka.brokers}}")
            .log("Generated bulk order BULK-${header.kafka.KEY} with line items -> eip.metadata.bulk-orders");
    }
}
