package com.example.eip.loanbroker;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.rest.RestBindingMode;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class GatewayRoute extends RouteBuilder {

    @Override
    public void configure() {
        restConfiguration()
            .bindingMode(RestBindingMode.json);

        rest("/api/loans")
            .post()
            .consumes("application/json")
            .produces("application/json")
            .to("direct:submit-loan");

        from("direct:submit-loan")
            .routeId("loan-gateway")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                String requestId = (String) body.get("requestId");
                if (requestId == null || requestId.isBlank()) {
                    requestId = UUID.randomUUID().toString();
                    body.put("requestId", requestId);
                }
                exchange.getIn().setHeader("requestId", requestId);
            })
            .marshal().json()
            .to("kafka:loan.requests?brokers={{kafka.brokers}}")
            .log("Loan request ${header.requestId} submitted")
            .process(exchange -> {
                String requestId = exchange.getIn().getHeader("requestId", String.class);
                exchange.getIn().setBody(java.util.Map.of(
                    "status", "ACCEPTED",
                    "requestId", requestId
                ));
            })
            .setHeader("CamelHttpResponseCode", constant(202))
            .marshal().json();
    }
}
