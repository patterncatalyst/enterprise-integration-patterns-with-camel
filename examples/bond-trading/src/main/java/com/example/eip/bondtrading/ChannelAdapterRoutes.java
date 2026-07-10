package com.example.eip.bondtrading;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

import java.util.Map;

/**
 * Channel Adapter routes that consume raw price feeds from three different
 * market data sources (Bloomberg, Reuters, Exchange) and normalize each
 * proprietary format into a CanonicalPrice before publishing to a single
 * canonical topic.
 */
@ApplicationScoped
public class ChannelAdapterRoutes extends RouteBuilder {

    // Bond metadata lookup — maps bond identifiers to ISIN / issuer / type
    private static final Map<String, String[]> BOND_REGISTRY = Map.of(
        "US912828Z123", new String[]{"US912828Z123", "US Treasury", "government"},
        "DE0001102309", new String[]{"DE0001102309", "German Bund", "government"},
        "GB00B24FGR04", new String[]{"GB00B24FGR04", "UK Gilt", "government"},
        "UST-10Y",      new String[]{"US912828Z123", "US Treasury", "government"},
        "BUND-10Y",     new String[]{"DE0001102309", "German Bund", "government"},
        "GILT-10Y",     new String[]{"GB00B24FGR04", "UK Gilt", "government"},
        "XS1234567890", new String[]{"XS1234567890", "JPMorgan Chase", "corporate"},
        "JPMC-5Y",      new String[]{"XS1234567890", "JPMorgan Chase", "corporate"},
        "XS9876543210", new String[]{"XS9876543210", "Goldman Sachs", "corporate"},
        "GS-3Y",        new String[]{"XS9876543210", "Goldman Sachs", "corporate"}
    );

    @Override
    public void configure() {
        /*
         * Bloomberg adapter — source sends ISIN directly in bondId,
         * prices in decimal, yields not provided (compute from price).
         */
        from("kafka:bond.feed.raw.bloomberg?brokers={{kafka.brokers}}&groupId=adapter-bloomberg")
            .routeId("adapter-bloomberg")
            .unmarshal().json(Map.class)
            .log("Bloomberg raw: ${body}")
            .process(exchange -> {
                var raw = exchange.getIn().getBody(Map.class);
                String bondId = (String) raw.get("bondId");
                String[] meta = lookupBond(bondId);

                double bid = ((Number) raw.get("bidPrice")).doubleValue();
                double ask = ((Number) raw.get("askPrice")).doubleValue();
                // Bloomberg provides decimal prices; estimate yield as inverse of price
                double bidYield = priceToYield(bid);
                double askYield = priceToYield(ask);

                exchange.getIn().setBody(Map.of(
                    "isin", meta[0], "issuer", meta[1], "bondType", meta[2],
                    "bidPrice", bid, "askPrice", ask,
                    "bidYield", bidYield, "askYield", askYield,
                    "bestSource", "bloomberg",
                    "timestamp", ((Number) raw.get("sourceTimestamp")).longValue()
                ));
            })
            .marshal().json()
            .to("kafka:bond.prices.canonical?brokers={{kafka.brokers}}")
            .log("Canonical price published from Bloomberg: ${body}");

        /*
         * Reuters adapter — source uses proprietary ticker symbols (e.g. UST-10Y),
         * prices in 32nds notation converted to decimal.
         */
        from("kafka:bond.feed.raw.reuters?brokers={{kafka.brokers}}&groupId=adapter-reuters")
            .routeId("adapter-reuters")
            .unmarshal().json(Map.class)
            .log("Reuters raw: ${body}")
            .process(exchange -> {
                var raw = exchange.getIn().getBody(Map.class);
                String bondId = (String) raw.get("bondId");
                String[] meta = lookupBond(bondId);

                // Reuters sends prices as "handle + ticks/32" — we receive pre-converted decimals
                // but apply a small spread adjustment to simulate format differences
                double bid = ((Number) raw.get("bidPrice")).doubleValue() - 0.015;
                double ask = ((Number) raw.get("askPrice")).doubleValue() + 0.015;
                double bidYield = priceToYield(bid);
                double askYield = priceToYield(ask);

                exchange.getIn().setBody(Map.of(
                    "isin", meta[0], "issuer", meta[1], "bondType", meta[2],
                    "bidPrice", roundPrice(bid), "askPrice", roundPrice(ask),
                    "bidYield", bidYield, "askYield", askYield,
                    "bestSource", "reuters",
                    "timestamp", ((Number) raw.get("sourceTimestamp")).longValue()
                ));
            })
            .marshal().json()
            .to("kafka:bond.prices.canonical?brokers={{kafka.brokers}}")
            .log("Canonical price published from Reuters: ${body}");

        /*
         * Exchange adapter — direct exchange feed uses ISINs, prices in decimal,
         * includes an exchange-specific fee baked into the ask.
         */
        from("kafka:bond.feed.raw.exchange?brokers={{kafka.brokers}}&groupId=adapter-exchange")
            .routeId("adapter-exchange")
            .unmarshal().json(Map.class)
            .log("Exchange raw: ${body}")
            .process(exchange -> {
                var raw = exchange.getIn().getBody(Map.class);
                String bondId = (String) raw.get("bondId");
                String[] meta = lookupBond(bondId);

                // Exchange feed includes a small fee in the ask; strip it for canonical form
                double bid = ((Number) raw.get("bidPrice")).doubleValue();
                double ask = ((Number) raw.get("askPrice")).doubleValue() - 0.03;
                double bidYield = priceToYield(bid);
                double askYield = priceToYield(ask);

                exchange.getIn().setBody(Map.of(
                    "isin", meta[0], "issuer", meta[1], "bondType", meta[2],
                    "bidPrice", bid, "askPrice", roundPrice(ask),
                    "bidYield", bidYield, "askYield", askYield,
                    "bestSource", "exchange",
                    "timestamp", ((Number) raw.get("sourceTimestamp")).longValue()
                ));
            })
            .marshal().json()
            .to("kafka:bond.prices.canonical?brokers={{kafka.brokers}}")
            .log("Canonical price published from Exchange: ${body}");
    }

    private static String[] lookupBond(String bondId) {
        return BOND_REGISTRY.getOrDefault(bondId,
            new String[]{bondId, "Unknown", "corporate"});
    }

    /** Simplified price-to-yield estimate: yield ~ (coupon / price) * 100. */
    private static double priceToYield(double price) {
        // Assume a 5% notional coupon for estimation purposes
        return Math.round((5.0 / price) * 100.0 * 10000.0) / 10000.0;
    }

    private static double roundPrice(double price) {
        return Math.round(price * 1000.0) / 1000.0;
    }
}
