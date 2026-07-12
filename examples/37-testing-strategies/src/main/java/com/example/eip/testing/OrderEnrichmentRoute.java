package com.example.eip.testing;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderEnrichmentRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("direct:enrich-order")
            .routeId("order-enrichment")
            .unmarshal().json(java.util.Map.class)
            .bean("inventoryService", "checkStock")
            .marshal().json()
            .log("Enriched order: ${body}")
            .to("direct:enriched-output");

        from("direct:enriched-output")
            .routeId("enriched-output-handler")
            .log("Enriched order ready for downstream processing");
    }
}
