package com.example.eip.observability;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.Exchange;
import org.apache.camel.MessageHistory;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
public class MessageHistoryRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=history-demo")
            .routeId("message-history-demo")
            .unmarshal().json()
            .log("Step 1: received order ${body[order_id]}")
            .to("direct:validate-order")
            .to("direct:enrich-order")
            .to("direct:log-history")
            .marshal().json()
            .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}");

        from("direct:validate-order")
            .routeId("history-validate")
            .log("Step 2: validating order ${body[order_id]}")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                order.put("validated", true);
            });

        from("direct:enrich-order")
            .routeId("history-enrich")
            .log("Step 3: enriching order ${body[order_id]}")
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                order.put("shipping_priority", "STANDARD");
            });

        from("direct:log-history")
            .routeId("history-logger")
            .process(exchange -> {
                List<MessageHistory> history = exchange.getProperty(
                    Exchange.MESSAGE_HISTORY, List.class);
                if (history != null) {
                    String path = history.stream()
                        .map(h -> h.getRouteId() + "@" + h.getNode().getId())
                        .collect(Collectors.joining(" -> "));
                    log.info("Message history for order {}: {}",
                        exchange.getIn().getBody(Map.class).get("order_id"), path);
                }
            });
    }
}
