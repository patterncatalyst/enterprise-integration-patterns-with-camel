package com.example.eip.management;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Channel Purger pattern — consumes messages from a topic and discards any
 * that are older than a configurable cutoff (default 10 minutes).  Only
 * recent, still-relevant messages are forwarded to a clean output topic.
 */
@ApplicationScoped
public class ChannelPurgerRoute extends RouteBuilder {

    /** Maximum age in milliseconds — messages older than this are purged. */
    private static final long MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

    @Override
    public void configure() {
        from("kafka:eip.orders.accepted?brokers={{kafka.brokers}}&groupId=channel-purger-demo")
            .routeId("channel-purger")
            .process(exchange -> {
                long orderTimestamp = 0;
                Object ts = exchange.getIn().getHeader("orderTimestamp");
                if (ts != null) {
                    orderTimestamp = Long.parseLong(ts.toString());
                }
                long age = System.currentTimeMillis() - orderTimestamp;
                exchange.getIn().setHeader("messageAge", age);
                exchange.getIn().setHeader("isStale", age > MAX_AGE_MS);
            })
            .log("Channel Purger — message age ${header.messageAge}ms, stale=${header.isStale}")
            .choice()
                .when(header("isStale").isEqualTo(true))
                    .log("PURGED — stale message discarded (age ${header.messageAge}ms)")
                .otherwise()
                    .log("FORWARDED — recent message sent to eip.orders.clean")
                    .to("kafka:eip.orders.clean?brokers={{kafka.brokers}}")
            .end();
    }
}
