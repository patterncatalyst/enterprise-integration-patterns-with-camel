package com.example.eip.testing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * Smart Proxy pattern — routes payment requests to either a mock
 * gateway or a production gateway based on the
 * {@code payment.gateway.mode} configuration property.
 *
 * <p>In {@code mock} mode the proxy returns a simulated approval
 * response without calling any external service.  In other modes
 * it logs what would be an external call (no actual HTTP requests
 * are made, keeping the example self-contained).
 */
@Component
public class SmartProxyRoute extends RouteBuilder {

    @Override
    public void configure() {
        // REST endpoint to submit payment requests
        rest("/payments")
            .post("/process")
                .to("direct:smart-proxy-entry");

        // Smart Proxy entry — route to mock or production gateway
        from("direct:smart-proxy-entry")
            .routeId("smart-proxy-router")
            .log("Smart Proxy: received payment request — mode={{payment.gateway.mode:production}}")
            .choice()
                .when().simple("'{{payment.gateway.mode:production}}' == 'mock'")
                    .log("Smart Proxy: routing to MOCK gateway")
                    .to("direct:mock-payment-gateway")
                .otherwise()
                    .log("Smart Proxy: routing to PRODUCTION gateway")
                    .to("direct:production-payment-gateway")
            .end();

        // Mock gateway — returns a simulated response
        from("direct:mock-payment-gateway")
            .routeId("smart-proxy-mock-gateway")
            .process(exchange -> {
                String response = """
                    {
                        "gateway": "MOCK",
                        "transaction_id": "TXN-MOCK-%d",
                        "status": "APPROVED",
                        "message": "Simulated approval — no real charge"
                    }
                    """.formatted(System.currentTimeMillis());
                exchange.getIn().setBody(response);
                exchange.getIn().setHeader("Content-Type", "application/json");
            })
            .log("Mock gateway: approved transaction ${body}");

        // Production gateway — logs the intent (no real external call)
        from("direct:production-payment-gateway")
            .routeId("smart-proxy-production-gateway")
            .log("Production gateway: would forward to external payment provider")
            .process(exchange -> {
                String response = """
                    {
                        "gateway": "PRODUCTION",
                        "transaction_id": "TXN-PROD-%d",
                        "status": "FORWARDED",
                        "message": "Request logged — external call simulated"
                    }
                    """.formatted(System.currentTimeMillis());
                exchange.getIn().setBody(response);
                exchange.getIn().setHeader("Content-Type", "application/json");
            })
            .log("Production gateway: response prepared");
    }
}
