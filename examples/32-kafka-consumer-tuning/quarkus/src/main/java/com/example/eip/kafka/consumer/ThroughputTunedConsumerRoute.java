package com.example.eip.kafka.consumer;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class ThroughputTunedConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:throughput-order-gen?period=2000")
            .routeId("throughput-order-generator")
            .process(exchange -> {
                long orderId = 5000 + (System.nanoTime() % 200);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 50, 29.99 * (1 + orderId % 4)));
            })
            .log("Producing order ${body}")
            .to("kafka:eip.orders.throughput?brokers={{kafka.brokers}}");

        from("kafka:eip.orders.throughput?brokers={{kafka.brokers}}"
                + "&groupId=throughput-consumer"
                + "&consumersCount=1"
                + "&fetchMinBytes=50000"
                + "&fetchWaitMaxMs=1000"
                + "&maxPollRecords=500"
                + "&autoCommitEnable=true"
                + "&autoCommitIntervalMs=5000")
            .routeId("throughput-tuned-consumer")
            .log("Throughput consumer received: partition=${header[kafka.PARTITION]} offset=${header[kafka.OFFSET]}")
            .to("direct:throughput-process");

        from("direct:throughput-process")
            .routeId("throughput-processor")
            .unmarshal().json(java.util.Map.class)
            .log("Processing order ${body[order_id]} — throughput-optimized (large batches, auto-commit)");
    }
}
