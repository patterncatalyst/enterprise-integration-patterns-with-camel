package com.example.eip.bondtrading;

import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Normalizer route that aggregates canonical prices by ISIN and selects
 * the best composite price: highest bid and lowest ask across all sources.
 */
@Component
public class NormalizerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:bond.prices.canonical?brokers={{kafka.brokers}}&groupId=normalizer")
            .routeId("price-normalizer")
            .unmarshal().json(Map.class)
            .setHeader("BondIsin", simple("${body[isin]}"))
            .aggregate(header("BondIsin"), new BestPriceStrategy())
                .completionInterval(500)
            .log("Best price for ${header.BondIsin}: bid=${body[bidPrice]} ask=${body[askPrice]} source=${body[bestSource]}")
            .marshal().json()
            .to("kafka:bond.prices.best?brokers={{kafka.brokers}}")
            .log("Best composite price published for ${header.BondIsin}");
    }

    /**
     * Aggregation strategy that builds a composite best price:
     * highest bid (best for seller) and lowest ask (best for buyer).
     */
    private static class BestPriceStrategy implements AggregationStrategy {

        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            if (oldExchange == null) {
                return newExchange;
            }

            var oldPrice = oldExchange.getIn().getBody(Map.class);
            var newPrice = newExchange.getIn().getBody(Map.class);

            double oldBid = ((Number) oldPrice.get("bidPrice")).doubleValue();
            double newBid = ((Number) newPrice.get("bidPrice")).doubleValue();
            double oldAsk = ((Number) oldPrice.get("askPrice")).doubleValue();
            double newAsk = ((Number) newPrice.get("askPrice")).doubleValue();

            // Pick highest bid
            double bestBid = Math.max(oldBid, newBid);
            // Pick lowest ask
            double bestAsk = Math.min(oldAsk, newAsk);

            // Track which source contributed the best bid
            String bestSource = newBid >= oldBid
                ? (String) newPrice.get("bestSource")
                : (String) oldPrice.get("bestSource");

            // Recalculate yields for the best prices
            double bidYield = estimateYield(bestBid);
            double askYield = estimateYield(bestAsk);

            long timestamp = Math.max(
                ((Number) oldPrice.get("timestamp")).longValue(),
                ((Number) newPrice.get("timestamp")).longValue()
            );

            newExchange.getIn().setBody(Map.of(
                "isin", newPrice.get("isin"),
                "issuer", newPrice.get("issuer"),
                "bondType", newPrice.get("bondType"),
                "bidPrice", bestBid,
                "askPrice", bestAsk,
                "bidYield", bidYield,
                "askYield", askYield,
                "bestSource", bestSource,
                "timestamp", timestamp
            ));

            return newExchange;
        }

        private static double estimateYield(double price) {
            return Math.round((5.0 / price) * 100.0 * 10000.0) / 10000.0;
        }
    }
}
