package com.example.eip.testing;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class PaymentGatewayRoute extends RouteBuilder {

    @Override
    public void configure() {
        rest("/api/payments")
            .post("/process")
                .consumes("application/json")
                .produces("application/json")
                .to("direct:payment-entry");

        from("direct:payment-entry")
            .routeId("payment-router")
            .log("Payment request received — mode={{payment.gateway.mode}}")
            .choice()
                .when().simple("'{{payment.gateway.mode}}' == 'mock'")
                    .to("direct:mock-gateway")
                .otherwise()
                    .to("direct:production-gateway")
            .end();

        from("direct:mock-gateway")
            .routeId("mock-gateway")
            .process(exchange -> {
                String body = exchange.getIn().getBody(String.class);
                exchange.getIn().setBody("""
                    {"gateway":"MOCK","status":"APPROVED","transaction_id":"TXN-MOCK-%d","message":"Simulated approval"}
                    """.formatted(System.currentTimeMillis()).trim());
                exchange.getIn().setHeader("Content-Type", "application/json");
            });

        from("direct:production-gateway")
            .routeId("production-gateway")
            .process(exchange -> {
                exchange.getIn().setBody("""
                    {"gateway":"PRODUCTION","status":"FORWARDED","transaction_id":"TXN-PROD-%d","message":"External call simulated"}
                    """.formatted(System.currentTimeMillis()).trim());
                exchange.getIn().setHeader("Content-Type", "application/json");
            });
    }
}
