package com.example.eip.testing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class OrderValidationRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("direct:validate-order")
            .routeId("order-validation")
            .unmarshal().json(java.util.Map.class)
            .choice()
                .when().simple("${body[shipping_type]} == 'HAZMAT'")
                    .log("Hazmat order ${body[order_id]} — routing to compliance review")
                    .to("direct:hazmat")
                .when().simple("${body[country]} != 'US'")
                    .log("International order ${body[order_id]} to ${body[country]}")
                    .to("direct:international")
                .otherwise()
                    .log("Domestic order ${body[order_id]}")
                    .to("direct:domestic")
            .end();

        from("direct:domestic")
            .routeId("domestic-handler")
            .log("Processing domestic shipment");

        from("direct:international")
            .routeId("international-handler")
            .log("Processing international shipment — customs declaration required");

        from("direct:hazmat")
            .routeId("hazmat-handler")
            .log("Processing hazmat shipment — compliance review required");
    }
}
