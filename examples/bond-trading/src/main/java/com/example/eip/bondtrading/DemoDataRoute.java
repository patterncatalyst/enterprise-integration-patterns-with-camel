package com.example.eip.bondtrading;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Timer-based demo data generator that produces simulated market data
 * and trade orders so the system can be exercised without a live feed.
 */
@ApplicationScoped
public class DemoDataRoute extends RouteBuilder {

    private static final String[] SOURCES = {"bloomberg", "reuters", "exchange"};

    // Bloomberg uses ISINs directly
    private static final String[] BLOOMBERG_BONDS = {
        "US912828Z123", "DE0001102309", "GB00B24FGR04", "XS1234567890", "XS9876543210"
    };

    // Reuters uses proprietary ticker symbols
    private static final String[] REUTERS_BONDS = {
        "UST-10Y", "BUND-10Y", "GILT-10Y", "JPMC-5Y", "GS-3Y"
    };

    // Exchange uses ISINs
    private static final String[] EXCHANGE_BONDS = BLOOMBERG_BONDS;

    private static final String[] PORTFOLIOS = {"PF-GOV-01", "PF-CORP-02", "PF-MIX-03"};
    private static final String[] SIDES = {"BUY", "SELL"};
    private static final String[] ORDER_TYPES = {"LIMIT", "MARKET"};

    @Override
    public void configure() {
        /*
         * Market data generator — every 2 seconds, pick a random source and
         * bond, generate a price update, and publish to the appropriate raw topic.
         */
        from("timer:demo-market-data?period=2000&delay=3000")
            .routeId("demo-market-data-generator")
            .process(exchange -> {
                var rng = ThreadLocalRandom.current();
                long counter = exchange.getIn().getHeader("CamelTimerCounter", Long.class);

                // Rotate through sources deterministically, with some randomness in prices
                String source = SOURCES[(int) (counter % SOURCES.length)];
                String bondId;
                switch (source) {
                    case "reuters" -> bondId = REUTERS_BONDS[rng.nextInt(REUTERS_BONDS.length)];
                    case "exchange" -> bondId = EXCHANGE_BONDS[rng.nextInt(EXCHANGE_BONDS.length)];
                    default -> bondId = BLOOMBERG_BONDS[rng.nextInt(BLOOMBERG_BONDS.length)];
                }

                // Generate realistic bond prices around par (100)
                double basePrice = 95.0 + rng.nextDouble() * 10.0; // 95–105 range
                double spread = 0.05 + rng.nextDouble() * 0.15;    // 5–20 bps spread
                double bid = Math.round(basePrice * 1000.0) / 1000.0;
                double ask = Math.round((basePrice + spread) * 1000.0) / 1000.0;
                int bidSize = (rng.nextInt(10) + 1) * 100;  // 100–1000 in lots of 100
                int askSize = (rng.nextInt(10) + 1) * 100;

                String json = """
                    {
                        "source": "%s",
                        "bondId": "%s",
                        "bidPrice": %.3f,
                        "askPrice": %.3f,
                        "bidSize": %d,
                        "askSize": %d,
                        "sourceTimestamp": %d
                    }
                    """.formatted(source, bondId, bid, ask, bidSize, askSize, System.currentTimeMillis());

                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", bondId);

                // Route to the correct source-specific topic
                exchange.getIn().setHeader("TargetTopic", "bond.feed.raw." + source);
            })
            .toD("kafka:${header.TargetTopic}?brokers={{kafka.brokers}}")
            .log("Demo price generated: ${header.TargetTopic} — ${body}");

        /*
         * Trade order generator — every 10 seconds, create a random trade order
         * and publish to the new-orders topic.
         */
        from("timer:demo-trade-orders?period=10000&delay=8000")
            .routeId("demo-trade-order-generator")
            .process(exchange -> {
                var rng = ThreadLocalRandom.current();
                long counter = exchange.getIn().getHeader("CamelTimerCounter", Long.class);

                String orderId = "ORD-%06d".formatted(counter);
                String portfolioId = PORTFOLIOS[rng.nextInt(PORTFOLIOS.length)];
                String isin = BLOOMBERG_BONDS[rng.nextInt(BLOOMBERG_BONDS.length)];
                String side = SIDES[rng.nextInt(SIDES.length)];
                int quantity = (rng.nextInt(50) + 1) * 10;  // 10–500 in lots of 10
                double limitPrice = 95.0 + rng.nextDouble() * 10.0;
                limitPrice = Math.round(limitPrice * 1000.0) / 1000.0;
                String orderType = ORDER_TYPES[rng.nextInt(ORDER_TYPES.length)];

                String json = """
                    {
                        "orderId": "%s",
                        "portfolioId": "%s",
                        "isin": "%s",
                        "side": "%s",
                        "quantity": %d,
                        "limitPrice": %.3f,
                        "orderType": "%s"
                    }
                    """.formatted(orderId, portfolioId, isin, side, quantity, limitPrice, orderType);

                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", orderId);
            })
            .to("kafka:bond.orders.new?brokers={{kafka.brokers}}")
            .log("Demo trade order generated: ${body}");
    }
}
