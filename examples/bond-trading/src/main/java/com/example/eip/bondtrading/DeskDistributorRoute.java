package com.example.eip.bondtrading;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

import java.util.Map;

/**
 * Desk Distributor — consumes best composite prices and multicasts them
 * to three trading desk filter routes using content-based routing.
 *
 * - Desk A: government bonds only
 * - Desk B: corporate bonds only
 * - Desk C: all bonds (no filter)
 */
@ApplicationScoped
public class DeskDistributorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:bond.prices.best?brokers={{kafka.brokers}}&groupId=desk-distributor")
            .routeId("desk-distributor")
            .unmarshal().json(Map.class)
            .log("Distributing best price for ${body[isin]} (${body[bondType]}) to trading desks")
            .multicast().parallelProcessing()
                .to("direct:filter-desk-a", "direct:filter-desk-b", "direct:filter-desk-c")
            .end();

        // Desk A — government bonds only
        from("direct:filter-desk-a")
            .routeId("filter-desk-a")
            .filter(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                return "government".equals(body.get("bondType"));
            })
            .log("Desk A (government): ${body[isin]} bid=${body[bidPrice]} ask=${body[askPrice]}")
            .marshal().json()
            .to("kafka:bond.prices.filtered.desk-a?brokers={{kafka.brokers}}");

        // Desk B — corporate bonds only
        from("direct:filter-desk-b")
            .routeId("filter-desk-b")
            .filter(exchange -> {
                var body = exchange.getIn().getBody(Map.class);
                return "corporate".equals(body.get("bondType"));
            })
            .log("Desk B (corporate): ${body[isin]} bid=${body[bidPrice]} ask=${body[askPrice]}")
            .marshal().json()
            .to("kafka:bond.prices.filtered.desk-b?brokers={{kafka.brokers}}");

        // Desk C — all bonds (no filter)
        from("direct:filter-desk-c")
            .routeId("filter-desk-c")
            .log("Desk C (all): ${body[isin]} bid=${body[bidPrice]} ask=${body[askPrice]}")
            .marshal().json()
            .to("kafka:bond.prices.filtered.desk-c?brokers={{kafka.brokers}}");
    }
}
