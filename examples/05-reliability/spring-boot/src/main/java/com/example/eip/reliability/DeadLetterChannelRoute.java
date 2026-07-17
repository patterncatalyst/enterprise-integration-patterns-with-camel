package com.example.eip.reliability;

import org.springframework.stereotype.Component;
import org.apache.camel.builder.RouteBuilder;

@Component
public class DeadLetterChannelRoute extends RouteBuilder {

    @Override
    public void configure() {
        errorHandler(deadLetterChannel("kafka:eip.orders.dlq?brokers={{kafka.brokers}}")
            .maximumRedeliveries(3)
            .redeliveryDelay(1000)
            .retryAttemptedLogLevel(org.apache.camel.LoggingLevel.WARN)
            .logExhausted(true)
            .useOriginalMessage());

        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=reliability-demo")
            .routeId("dead-letter-channel-demo")
            .unmarshal().json()
            .log("Processing order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                long orderId = ((Number) body.get("order_id")).longValue();
                if (orderId % 5 == 0) {
                    throw new RuntimeException(
                        "Simulated failure for order " + orderId);
                }
            })
            .log("Order ${body[order_id]} processed successfully")
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}");

        from("kafka:eip.orders.dlq?brokers={{kafka.brokers}}&groupId=dlq-monitor")
            .routeId("dlq-monitor")
            .log("DLQ received failed order: ${body}")
            .log("Failure reason: ${header.CamelExceptionCaught}");
    }
}
