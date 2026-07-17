package com.example.eip.loanbroker;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

import java.util.Map;

@ApplicationScoped
public class AggregatorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:loan.bank.reply?brokers={{kafka.brokers}}&groupId=loan-aggregator")
            .routeId("loan-offer-aggregator")
            .unmarshal().json()
            .log("Received bank reply: ${body[bankName]} for request ${body[requestId]} — rate=${body[interestRate]}%")
            .aggregate(jsonpath("$.requestId"), new BestOfferStrategy())
                .completionTimeout(10000)
            .log("Best offer for ${body[requestId]}: ${body[bankName]} at ${body[interestRate]}% — $${body[monthlyPayment]}/mo")
            .marshal().json()
            .to("kafka:loan.results?brokers={{kafka.brokers}}")
            .log("Final result published to loan.results for ${header.requestId}");
    }

    /**
     * Aggregation strategy that picks the lowest interest rate among approved quotes.
     * If no approved quotes exist, keeps the latest quote for logging purposes.
     */
    private static class BestOfferStrategy implements AggregationStrategy {

        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            var newQuote = newExchange.getIn().getBody(Map.class);

            if (oldExchange == null) {
                return newExchange;
            }

            var oldQuote = oldExchange.getIn().getBody(Map.class);

            boolean oldApproved = Boolean.TRUE.equals(oldQuote.get("approved"));
            boolean newApproved = Boolean.TRUE.equals(newQuote.get("approved"));

            // Prefer approved over not-approved
            if (newApproved && !oldApproved) {
                return newExchange;
            }
            if (!newApproved && oldApproved) {
                return oldExchange;
            }

            // Both approved (or both not): pick lowest rate
            double oldRate = ((Number) oldQuote.get("interestRate")).doubleValue();
            double newRate = ((Number) newQuote.get("interestRate")).doubleValue();

            return newRate < oldRate ? newExchange : oldExchange;
        }
    }
}
