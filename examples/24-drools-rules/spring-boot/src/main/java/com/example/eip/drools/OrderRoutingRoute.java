package com.example.eip.drools;

import org.springframework.stereotype.Component;

import org.apache.camel.builder.RouteBuilder;

@Component
public class OrderRoutingRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=rule-router")
            .routeId("drools-content-router")
            .unmarshal().json(java.util.Map.class)
            .bean("ruleBasedRouter", "evaluate")
            .log("Rule engine decided: ${header.routingDecision} for order ${body[order_id]}")
            .toD("direct:${header.routingDecision}");

        from("direct:standard")
            .routeId("route-standard")
            .log("Standard routing for order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.standard?brokers={{kafka.brokers}}");

        from("direct:express")
            .routeId("route-express")
            .log("Express routing for order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.express?brokers={{kafka.brokers}}");

        from("direct:hazmat")
            .routeId("route-hazmat")
            .log("Hazmat routing for order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.hazmat?brokers={{kafka.brokers}}");

        from("direct:fraud-review")
            .routeId("route-fraud-review")
            .log("Fraud review routing for order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.fraud-review?brokers={{kafka.brokers}}");
    }
}
