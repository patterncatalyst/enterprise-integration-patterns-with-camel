package com.example.eip.kafka;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class TransactionalPipelineRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}"
                + "&groupId=transactional-pipeline"
                + "&autoOffsetReset=earliest"
                + "&autoCommitEnable=false"
                + "&allowManualCommit=true"
                + "&breakOnFirstError=true")
            .routeId("transactional-pipeline")
            .log("Consuming order from partition ${header[kafka.PARTITION]} offset ${header[kafka.OFFSET]}")
            .unmarshal().json()
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                long orderId = ((Number) body.get("order_id")).longValue();
                String customerId = (String) body.get("customer_id");
                Number amount = (Number) body.get("amount");

                String enriched = String.format(
                    "{\"order_id\": %d, \"customer_id\": \"%s\", \"amount\": %.2f, "
                        + "\"status\": \"ENRICHED\", \"warehouse\": \"WH-%d\", "
                        + "\"priority\": \"%s\", \"enriched_at\": \"%s\"}",
                    orderId,
                    customerId,
                    amount.doubleValue(),
                    orderId % 3 + 1,
                    amount.doubleValue() > 60.0 ? "HIGH" : "STANDARD",
                    java.time.Instant.now().toString());
                exchange.getIn().setBody(enriched);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(orderId));
            })
            .log("Enriched order ${header[kafka.KEY]} -> priority ${body}")
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}"
                + "&requestRequiredAcks=all"
                + "&retries=3"
                + "&enableIdempotence=true")
            .process(exchange -> {
                org.apache.camel.component.kafka.consumer.KafkaManualCommit commit =
                    exchange.getIn().getHeader(
                        org.apache.camel.component.kafka.KafkaConstants.MANUAL_COMMIT,
                        org.apache.camel.component.kafka.consumer.KafkaManualCommit.class);
                if (commit != null) {
                    commit.commit();
                }
            })
            .log("Committed offset for order ${header[kafka.KEY]}");
    }
}
