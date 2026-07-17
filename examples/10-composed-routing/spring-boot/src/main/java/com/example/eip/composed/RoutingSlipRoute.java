package com.example.eip.composed;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class RoutingSlipRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=routing-slip-demo")
            .routeId("order-routing-slip")
            .unmarshal().json()
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                var steps = new ArrayList<String>();
                steps.add("direct:validate-order");

                boolean hazmat = Boolean.TRUE.equals(body.get("contains_hazmat"));
                if (hazmat) {
                    steps.add("direct:hazmat-compliance");
                }

                String country = (String) body.getOrDefault("destination_country", "US");
                if (!"US".equals(country)) {
                    steps.add("direct:customs-classification");
                }

                steps.add("direct:assign-carrier");
                exchange.getIn().setHeader("orderSlip", String.join(",", steps));
            })
            .log("Routing slip: ${header.orderSlip}")
            .routingSlip(header("orderSlip"), ",");

        from("direct:validate-order")
            .routeId("validate-order")
            .log("Validating order ${body[order_id]}");

        from("direct:hazmat-compliance")
            .routeId("hazmat-compliance")
            .log("HAZMAT compliance check for order ${body[order_id]}");

        from("direct:customs-classification")
            .routeId("customs-classification")
            .log("Customs classification for order ${body[order_id]} to ${body[destination_country]}");

        from("direct:assign-carrier")
            .routeId("assign-carrier")
            .log("Assigning carrier for order ${body[order_id]}");
    }
}
