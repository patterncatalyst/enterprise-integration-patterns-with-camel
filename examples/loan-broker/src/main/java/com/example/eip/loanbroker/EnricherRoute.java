package com.example.eip.loanbroker;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

import java.util.Map;

@ApplicationScoped
public class EnricherRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:loan.requests?brokers={{kafka.brokers}}&groupId=loan-enricher")
            .routeId("credit-enricher")
            .unmarshal().json()
            .log("Enriching loan request ${body[requestId]} for customer ${body[customerId]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                String customerId = (String) body.get("customerId");

                // Simulate credit bureau lookup based on customerId hash
                int hash = Math.abs(customerId.hashCode());
                int creditHistory = 2 + (hash % 28);       // 2-29 years of history
                double debtToIncome = 0.15 + (hash % 35) * 0.01; // 0.15-0.49 ratio

                exchange.getIn().setHeader("creditHistory", creditHistory);
                exchange.getIn().setHeader("debtToIncome", String.format("%.2f", debtToIncome));

                // Pass through credit score from the original request
                int creditScore = ((Number) body.get("creditScore")).intValue();
                exchange.getIn().setHeader("creditScore", creditScore);
                exchange.getIn().setHeader("requestId", body.get("requestId"));
            })
            .log("Credit bureau: history=${header.creditHistory}yr, DTI=${header.debtToIncome}")
            .marshal().json()
            .to("kafka:loan.enriched?brokers={{kafka.brokers}}")
            .log("Enriched request ${header.requestId} published to loan.enriched");
    }
}
