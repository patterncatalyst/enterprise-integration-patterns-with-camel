package com.example.eip.transform;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class ContentFilterRoute extends RouteBuilder {

    private static final Set<String> ALLOWED_FIELDS = Set.of(
        "order_id", "item_sku", "quantity", "amount",
        "destination_country", "shipping_priority", "status"
    );

    @Override
    public void configure() {
        from("kafka:eip.orders.enriched?brokers={{kafka.brokers}}&groupId=filter-demo")
            .routeId("content-filter")
            .unmarshal().json()
            .log("Filtering PII from order ${body[order_id]}")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                var filtered = new LinkedHashMap<String, Object>();
                for (var entry : ((Map<String, Object>) order).entrySet()) {
                    if (ALLOWED_FIELDS.contains(entry.getKey())) {
                        filtered.put(entry.getKey(), entry.getValue());
                    }
                }
                exchange.getIn().setBody(filtered);
            })
            .log("Filtered: ${body}")
            .marshal().json()
            .to("kafka:eip.orders.analytics?brokers={{kafka.brokers}}");
    }
}
