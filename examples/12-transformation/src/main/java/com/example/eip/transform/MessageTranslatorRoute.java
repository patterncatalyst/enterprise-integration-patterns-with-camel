package com.example.eip.transform;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class MessageTranslatorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.external?brokers={{kafka.brokers}}&groupId=translator-demo")
            .routeId("message-translator")
            .unmarshal().json()
            .log("External order received: ${body}")
            .process(exchange -> {
                var external = exchange.getIn().getBody(Map.class);
                var canonical = new LinkedHashMap<String, Object>();
                canonical.put("order_id", external.get("orderNumber"));
                canonical.put("customer_id", external.get("clientRef"));
                canonical.put("item_sku", external.get("productCode"));
                canonical.put("quantity", external.get("qty"));
                canonical.put("amount", external.get("totalValue"));
                canonical.put("destination_country",
                    external.getOrDefault("shipToCountry", "US"));
                canonical.put("contains_hazmat",
                    Boolean.TRUE.equals(external.get("hazardous")));
                canonical.put("status", "NEW");
                exchange.getIn().setBody(canonical);
            })
            .log("Translated to canonical: order_id=${body[order_id]}, amount=${body[amount]}")
            .marshal().json()
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}");
    }
}
