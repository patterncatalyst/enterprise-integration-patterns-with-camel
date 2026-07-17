package com.example.eip.observability;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class WireTapMonitorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=wiretap-demo")
            .routeId("wiretap-order-processor")
            .unmarshal().json()
            .log("Processing order ${body[order_id]}")
            .wireTap("direct:audit-log")
            .log("Order ${body[order_id]} processed")
            .marshal().json()
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}");

        from("direct:audit-log")
            .routeId("audit-log-writer")
            .log("AUDIT: order_id=${body[order_id]}, customer=${body[customer_id]}, amount=${body[amount]}")
            .marshal().json()
            .to("kafka:eip.orders.audit?brokers={{kafka.brokers}}");
    }
}
