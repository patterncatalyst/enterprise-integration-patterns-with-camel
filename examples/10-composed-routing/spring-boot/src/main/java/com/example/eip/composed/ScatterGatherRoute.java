package com.example.eip.composed;

import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class ScatterGatherRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.shipping.rate-requests?brokers={{kafka.brokers}}&groupId=scatter-gather-demo")
            .routeId("carrier-scatter-gather")
            .unmarshal().json()
            .log("Rate request for order ${body[order_id]}: ${body[weight_kg]}kg to ${body[destination_country]}")
            .multicast(new BestRateStrategy())
                .parallelProcessing()
                .timeout(5000)
                .to("direct:quote-fastline", "direct:quote-parcelco", "direct:quote-postco")
            .end()
            .log("Best rate: ${body[carrier]} at $${body[rate]}")
            .marshal().json()
            .to("kafka:eip.shipping.best-rate?brokers={{kafka.brokers}}");

        from("direct:quote-fastline")
            .routeId("quote-fastline")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                double weight = ((Number) order.get("weight_kg")).doubleValue();
                double rate = 12.99 + (weight * 1.50);
                exchange.getIn().setBody(Map.of(
                    "carrier", "FASTLINE",
                    "rate", rate,
                    "delivery_days", 3,
                    "order_id", order.get("order_id")
                ));
            })
            .log("FASTLINE quoted $${body[rate]}");

        from("direct:quote-parcelco")
            .routeId("quote-parcelco")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                double weight = ((Number) order.get("weight_kg")).doubleValue();
                double rate = 10.50 + (weight * 1.75);
                exchange.getIn().setBody(Map.of(
                    "carrier", "PARCELCO",
                    "rate", rate,
                    "delivery_days", 4,
                    "order_id", order.get("order_id")
                ));
            })
            .log("PARCELCO quoted $${body[rate]}");

        from("direct:quote-postco")
            .routeId("quote-postco")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                double weight = ((Number) order.get("weight_kg")).doubleValue();
                double rate = 8.00 + (weight * 2.00);
                exchange.getIn().setBody(Map.of(
                    "carrier", "POSTCO",
                    "rate", rate,
                    "delivery_days", 5,
                    "order_id", order.get("order_id")
                ));
            })
            .log("POSTCO quoted $${body[rate]}");
    }

    static class BestRateStrategy implements AggregationStrategy {
        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            if (oldExchange == null) return newExchange;
            var oldRate = ((Number) oldExchange.getIn().getBody(Map.class).get("rate")).doubleValue();
            var newRate = ((Number) newExchange.getIn().getBody(Map.class).get("rate")).doubleValue();
            return newRate < oldRate ? newExchange : oldExchange;
        }
    }
}
