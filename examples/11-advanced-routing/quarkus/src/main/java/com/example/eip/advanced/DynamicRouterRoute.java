package com.example.eip.advanced;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class DynamicRouterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=dynamic-router-demo")
            .routeId("dynamic-router-demo")
            .unmarshal().json()
            .log("Dynamic Router received order ${body[order_id]}")
            .dynamicRouter(method("orderRoutingBean", "route"))
            .marshal().json()
            .to("kafka:eip.orders.dynamic-routed?brokers={{kafka.brokers}}");

        from("direct:validate-order")
            .routeId("dr-validate-order")
            .log("Step 1 - Validating order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("validated", true);
            });

        from("direct:check-inventory")
            .routeId("dr-check-inventory")
            .log("Step 2 - Checking inventory for order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("inventory_checked", true);
            });

        from("direct:calculate-shipping")
            .routeId("dr-calculate-shipping")
            .log("Step 3 - Calculating shipping for order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("shipping_calculated", true);
            });
    }

    @ApplicationScoped
    @Named("orderRoutingBean")
    public static class OrderRoutingBean {

        private static final String STEP_PROPERTY = "dynamicRouterStep";

        public String route(Exchange exchange) {
            int step = exchange.getProperty(STEP_PROPERTY, 0, Integer.class);
            exchange.setProperty(STEP_PROPERTY, step + 1);

            return switch (step) {
                case 0 -> "direct:validate-order";
                case 1 -> "direct:check-inventory";
                case 2 -> "direct:calculate-shipping";
                default -> null; // stop routing
            };
        }
    }
}
