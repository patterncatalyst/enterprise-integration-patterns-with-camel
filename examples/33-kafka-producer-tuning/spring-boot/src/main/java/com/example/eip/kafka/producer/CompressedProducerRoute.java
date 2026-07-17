package com.example.eip.kafka.producer;

import org.springframework.stereotype.Component;

import org.apache.camel.builder.RouteBuilder;

@Component
public class CompressedProducerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:compressed-order-gen?period=3000")
            .routeId("compressed-producer")
            .process(exchange -> {
                long orderId = 9000 + (System.nanoTime() % 100);
                StringBuilder sb = new StringBuilder();
                sb.append(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, ",
                    orderId, orderId % 30, 99.99 * (1 + orderId % 5)));
                sb.append("\"items\": [");
                for (int i = 0; i < 5; i++) {
                    if (i > 0) sb.append(", ");
                    sb.append(String.format(
                        "{\"sku\": \"SKU-%04d\", \"qty\": %d, \"price\": %.2f}",
                        (orderId + i) % 1000, 1 + i, 19.99 * (1 + i)));
                }
                sb.append("], \"status\": \"placed\"}");
                exchange.getIn().setBody(sb.toString());
            })
            .log("Compressed producer sending large order")
            .to("kafka:eip.orders.compressed?brokers={{kafka.brokers}}"
                + "&compressionCodec=lz4");

        from("kafka:eip.orders.compressed?brokers={{kafka.brokers}}&groupId=compressed-verifier")
            .routeId("compressed-verifier")
            .unmarshal().json(java.util.Map.class)
            .log("Compressed verifier received order ${body[order_id]} (LZ4 decompressed by broker)");
    }
}
