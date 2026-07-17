package com.example.eip.testing;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Detour pattern — conditionally routes messages through an enrichment
 * step based on the {@code feature.enrichment.enabled} configuration
 * property.  When the property is {@code true}, orders are enriched
 * with additional shipping metadata; when {@code false}, enrichment
 * is bypassed entirely.
 */
@ApplicationScoped
public class DetourRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=detour-demo")
            .routeId("detour-enrichment")
            .unmarshal().json()
            .log("Detour: evaluating enrichment for order ${body[order_id]}")
            .choice()
                .when().simple("{{feature.enrichment.enabled:true}}")
                    .log("Detour: enrichment ENABLED — enriching order ${body[order_id]}")
                    .to("direct:enrich-order")
                .otherwise()
                    .log("Detour: enrichment DISABLED — bypassing for order ${body[order_id]}")
            .end()
            .marshal().json()
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}")
            .log("Detour: order ${body} routed to eip.orders.enriched");

        // Enrichment sub-route — adds shipping metadata
        from("direct:enrich-order")
            .routeId("detour-enrich-order")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("warehouse", "WH-EAST-01");
                body.put("estimated_weight_kg", 2.5);
                body.put("enriched", true);
                exchange.getIn().setBody(body);
            })
            .log("Enriched order ${body[order_id]} with warehouse and weight data");
    }
}
