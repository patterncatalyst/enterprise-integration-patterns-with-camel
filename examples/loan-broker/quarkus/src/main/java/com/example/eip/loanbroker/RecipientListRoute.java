package com.example.eip.loanbroker;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

import java.util.ArrayList;
import java.util.Map;

@ApplicationScoped
public class RecipientListRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:loan.enriched?brokers={{kafka.brokers}}&groupId=loan-recipient-list")
            .routeId("bank-recipient-list")
            .unmarshal().json()
            .log("Determining eligible banks for request ${body[requestId]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                int creditScore = ((Number) body.get("creditScore")).intValue();
                double amount = ((Number) body.get("amount")).doubleValue();

                var recipients = new ArrayList<String>();

                // bank-a: always eligible
                recipients.add("direct:quote-bank-a");

                // bank-b: creditScore >= 650 and amount <= 500000
                if (creditScore >= 650 && amount <= 500_000) {
                    recipients.add("direct:quote-bank-b");
                }

                // bank-c: creditScore >= 720 (prime-only)
                if (creditScore >= 720) {
                    recipients.add("direct:quote-bank-c");
                }

                exchange.getIn().setHeader("eligibleBanks",
                    String.join(",", recipients));
                exchange.getIn().setHeader("requestId", body.get("requestId"));
            })
            .log("Eligible banks for ${header.requestId}: ${header.eligibleBanks}")
            .recipientList(header("eligibleBanks")).delimiter(",")
            .parallelProcessing();
    }
}
