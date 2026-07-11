package com.example.eip.advanced;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class WireTapRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.processing?brokers={{kafka.brokers}}&groupId=wiretap-demo")
            .routeId("wire-tap-main")
            .unmarshal().json()
            .log("Processing order ${body[order_id]} — main flow")
            .wireTap("direct:audit")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("status", "PROCESSED");
                body.put("processed_at", System.currentTimeMillis());
            })
            .log("Order ${body[order_id]} processed successfully")
            .marshal().json()
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}");

        from("direct:audit")
            .routeId("wire-tap-audit")
            .log("AUDIT: Recording copy of order ${body[order_id]} for compliance")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("audit_timestamp", System.currentTimeMillis());
                body.put("audit_source", "wire-tap");
            })
            .marshal().json()
            .to("kafka:eip.orders.audit?brokers={{kafka.brokers}}")
            .log("AUDIT: Order ${header.kafka.KEY} written to audit topic");
    }
}
