package com.example.eip.transform;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class ContentEnricherRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=enricher-demo")
            .routeId("content-enricher")
            .unmarshal().json()
            .log("Enriching order ${body[order_id]}")
            .enrich("direct:address-lookup", (oldExchange, newExchange) -> {
                var order = oldExchange.getIn().getBody(Map.class);
                var address = newExchange.getIn().getBody(Map.class);
                var enriched = new LinkedHashMap<>(order);
                enriched.put("destination_address", address.get("formatted_address"));
                enriched.put("shipping_zone", address.get("zone"));
                enriched.put("postal_code", address.get("postal_code"));
                oldExchange.getIn().setBody(enriched);
                return oldExchange;
            })
            .log("Enriched: zone=${body[shipping_zone]}, address=${body[destination_address]}")
            .marshal().json()
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}");

        from("direct:address-lookup")
            .routeId("address-lookup-stub")
            .process(exchange -> {
                exchange.getIn().setBody(Map.of(
                    "formatted_address", "123 Main St, Springfield, IL 62701",
                    "zone", "ZONE-3",
                    "postal_code", "62701"
                ));
            });
    }
}
