package com.example.eip.metadata;

import java.util.UUID;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class CorrelationIdRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Producer: reads orders, stamps a correlation ID, and forwards for processing
        from("kafka:eip.metadata.orders?brokers={{kafka.brokers}}&groupId=correlation-producer")
            .routeId("correlation-id-producer")
            .process(exchange -> {
                String correlationId = UUID.randomUUID().toString();
                exchange.getIn().setHeader("X-Correlation-ID", correlationId);
            })
            .log("Assigned Correlation-ID ${header.X-Correlation-ID} to order")
            .to("direct:validate-order");

        // Processing step: the correlation ID travels with the message
        from("direct:validate-order")
            .routeId("correlation-id-validate")
            .unmarshal().json()
            .log("[${header.X-Correlation-ID}] Validating order ${body[order_id]}")
            .to("direct:enrich-order");

        // Enrichment step: correlation ID still present
        from("direct:enrich-order")
            .routeId("correlation-id-enrich")
            .log("[${header.X-Correlation-ID}] Enriching order ${body[order_id]}")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("enriched", true);
                body.put("warehouse", "WH-EAST");
            })
            .marshal().json()
            .to("kafka:eip.metadata.orders.correlated?brokers={{kafka.brokers}}");

        // Consumer: logs the correlation ID on the reply side to show end-to-end tracking
        from("kafka:eip.metadata.orders.correlated?brokers={{kafka.brokers}}&groupId=correlation-consumer")
            .routeId("correlation-id-consumer")
            .log("Correlated reply received — Correlation-ID: ${header.X-Correlation-ID}")
            .unmarshal().json()
            .log("[${header.X-Correlation-ID}] Order ${body[order_id]} fully processed (enriched=${body[enriched]})");
    }
}
