package com.example.eip.routing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class ContentBasedRouterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=routing-demo")
            .routeId("content-based-router")
            .unmarshal().json()
            .log("Order received: ${body[order_id]} to ${body[destination_country]}")
            .choice()
                .when(simple("${body[contains_hazmat]} == true"))
                    .log("HAZMAT order ${body[order_id]} → hazmat handler")
                    .to("kafka:eip.orders.hazmat?brokers={{kafka.brokers}}")
                .when(simple("${body[destination_country]} != 'US'"))
                    .log("International order ${body[order_id]} → customs")
                    .to("kafka:eip.orders.international?brokers={{kafka.brokers}}")
                .otherwise()
                    .log("Domestic order ${body[order_id]} → standard")
                    .to("kafka:eip.orders.domestic?brokers={{kafka.brokers}}")
            .end();
    }
}
