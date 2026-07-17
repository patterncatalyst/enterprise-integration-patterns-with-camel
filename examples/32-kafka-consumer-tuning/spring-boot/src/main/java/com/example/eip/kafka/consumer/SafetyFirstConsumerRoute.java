package com.example.eip.kafka.consumer;

import org.springframework.stereotype.Component;

import org.apache.camel.builder.RouteBuilder;

@Component
public class SafetyFirstConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.safety?brokers={{kafka.brokers}}"
                + "&groupId=safety-consumer"
                + "&autoCommitEnable=false"
                + "&allowManualCommit=true"
                + "&breakOnFirstError=true"
                + "&isolationLevel=read_committed"
                + "&maxPollRecords=1")
            .routeId("safety-first-consumer")
            .log("Safety consumer received: order at offset ${header[kafka.OFFSET]}")
            .unmarshal().json(java.util.Map.class)
            .to("direct:safety-process")
            .process(exchange -> {
                var commitManager = exchange.getIn()
                    .getHeader(org.apache.camel.component.kafka.KafkaConstants.MANUAL_COMMIT,
                        org.apache.camel.component.kafka.consumer.KafkaManualCommit.class);
                if (commitManager != null) {
                    commitManager.commit();
                }
            })
            .log("Committed offset after processing order ${body[order_id]}");

        from("direct:safety-process")
            .routeId("safety-processor")
            .log("Processing order ${body[order_id]} — safety-first (manual commit, read_committed, one-at-a-time)");

        from("timer:safety-order-gen?period=4000")
            .routeId("safety-order-generator")
            .process(exchange -> {
                long orderId = 6000 + (System.nanoTime() % 100);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 30, 49.99 * (1 + orderId % 3)));
            })
            .to("kafka:eip.orders.safety?brokers={{kafka.brokers}}");
    }
}
