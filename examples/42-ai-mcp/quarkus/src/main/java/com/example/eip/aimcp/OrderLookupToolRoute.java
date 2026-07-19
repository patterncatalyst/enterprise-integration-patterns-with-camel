package com.example.eip.aimcp;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderLookupToolRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        from("langchain4j-tools:orderTools?tags=shipping&description=Look up the status of a shipping order by order ID")
            .routeId("order-lookup-tool")
            .log("Tool call — looking up order: ${body}")
            .choice()
                .when(simple("${body} contains 'ORD-001'"))
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FedEx\",\"eta\":\"2026-07-20\"}"))
                .when(simple("${body} contains 'ORD-002'"))
                    .setBody(constant("{\"orderId\":\"ORD-002\",\"status\":\"PROCESSING\",\"warehouse\":\"West Coast Hub\"}"))
                .when(simple("${body} contains 'ORD-003'"))
                    .setBody(constant("{\"orderId\":\"ORD-003\",\"status\":\"DELIVERED\",\"deliveredAt\":\"2026-07-15\"}"))
                .otherwise()
                    .setBody(constant("{\"error\":\"Order not found\"}"))
            .end()
            .log("Tool response: ${body}");
    }
}
