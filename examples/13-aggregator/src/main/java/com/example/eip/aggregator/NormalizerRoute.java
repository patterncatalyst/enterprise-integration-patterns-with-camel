package com.example.eip.aggregator;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class NormalizerRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Partner A: uses "orderId", "client", "product", "count", "total"
        from("kafka:eip.orders.partner-a?brokers={{kafka.brokers}}&groupId=normalizer-demo")
            .routeId("normalizer-partner-a")
            .unmarshal().json()
            .log("Partner A order received: ${body}")
            .process(exchange -> {
                var src = exchange.getIn().getBody(Map.class);
                var canonical = new LinkedHashMap<String, Object>();
                canonical.put("order_id", src.get("orderId"));
                canonical.put("customer_id", src.get("client"));
                canonical.put("item_sku", src.get("product"));
                canonical.put("quantity", src.get("count"));
                canonical.put("amount", src.get("total"));
                canonical.put("source", "PARTNER_A");
                canonical.put("status", "NEW");
                exchange.getIn().setBody(canonical);
            })
            .marshal().json()
            .to("kafka:eip.orders.normalized?brokers={{kafka.brokers}}");

        // Partner B: uses "order_number", "buyer_ref", "sku", "qty", "price"
        from("kafka:eip.orders.partner-b?brokers={{kafka.brokers}}&groupId=normalizer-demo")
            .routeId("normalizer-partner-b")
            .unmarshal().json()
            .log("Partner B order received: ${body}")
            .process(exchange -> {
                var src = exchange.getIn().getBody(Map.class);
                var canonical = new LinkedHashMap<String, Object>();
                canonical.put("order_id", src.get("order_number"));
                canonical.put("customer_id", src.get("buyer_ref"));
                canonical.put("item_sku", src.get("sku"));
                canonical.put("quantity", src.get("qty"));
                canonical.put("amount", src.get("price"));
                canonical.put("source", "PARTNER_B");
                canonical.put("status", "NEW");
                exchange.getIn().setBody(canonical);
            })
            .marshal().json()
            .to("kafka:eip.orders.normalized?brokers={{kafka.brokers}}");

        // Partner C: uses "po_id", "account", "item_code", "units", "value"
        from("kafka:eip.orders.partner-c?brokers={{kafka.brokers}}&groupId=normalizer-demo")
            .routeId("normalizer-partner-c")
            .unmarshal().json()
            .log("Partner C order received: ${body}")
            .process(exchange -> {
                var src = exchange.getIn().getBody(Map.class);
                var canonical = new LinkedHashMap<String, Object>();
                canonical.put("order_id", src.get("po_id"));
                canonical.put("customer_id", src.get("account"));
                canonical.put("item_sku", src.get("item_code"));
                canonical.put("quantity", src.get("units"));
                canonical.put("amount", src.get("value"));
                canonical.put("source", "PARTNER_C");
                canonical.put("status", "NEW");
                exchange.getIn().setBody(canonical);
            })
            .marshal().json()
            .to("kafka:eip.orders.normalized?brokers={{kafka.brokers}}");
    }
}
