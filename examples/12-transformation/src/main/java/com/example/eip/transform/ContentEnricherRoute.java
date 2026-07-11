package com.example.eip.transform;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class ContentEnricherRoute extends RouteBuilder {

    @Inject
    RedisProductCatalog productCatalog;

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=enricher-demo")
            .routeId("content-enricher")
            .unmarshal().json()
            .log("Enriching order ${body[order_id]}")
            .enrich("direct:redis-product-lookup", (oldExchange, newExchange) -> {
                var order = oldExchange.getIn().getBody(Map.class);
                var product = newExchange.getIn().getBody(Map.class);
                var enriched = new LinkedHashMap<>(order);
                enriched.put("product_name", product.get("name"));
                enriched.put("product_category", product.get("category"));
                enriched.put("weight_kg", product.get("weight_kg"));
                enriched.put("shipping_zone", product.get("shipping_zone"));
                oldExchange.getIn().setBody(enriched);
                return oldExchange;
            })
            .log("Enriched from Redis: ${body[item_sku]} → ${body[product_name]} (${body[shipping_zone]})")
            .marshal().json()
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}");

        from("direct:redis-product-lookup")
            .routeId("redis-product-lookup")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var order = exchange.getIn().getBody(Map.class);
                String sku = (String) order.get("item_sku");
                Map<String, String> product = productCatalog.lookup(sku);
                exchange.getIn().setBody(product);
            });
    }
}
