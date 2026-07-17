package com.example.eip.otel;

import java.util.Map;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class TracedOrderRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=otel-traced")
            .routeId("traced-order-pipeline")
            .unmarshal().json(Map.class)
            .log("Trace started for order ${body[order_id]}")
            .to("direct:otel-validate")
            .to("direct:otel-enrich")
            .to("direct:otel-complete");

        from("direct:otel-validate")
            .routeId("otel-validate-order")
            .log("Validating order ${body[order_id]}")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> order = exchange.getIn().getBody(Map.class);
                double amount = ((Number) order.get("amount")).doubleValue();
                order.put("valid", amount > 0);
                Thread.sleep(10); // simulate validation work
            });

        from("direct:otel-enrich")
            .routeId("otel-enrich-order")
            .log("Enriching order ${body[order_id]}")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> order = exchange.getIn().getBody(Map.class);
                order.put("warehouse", "EAST-1");
                order.put("enriched_at", System.currentTimeMillis());
                Thread.sleep(15); // simulate enrichment lookup
            });

        from("direct:otel-complete")
            .routeId("otel-complete-order")
            .log("Completing order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}");
    }
}
