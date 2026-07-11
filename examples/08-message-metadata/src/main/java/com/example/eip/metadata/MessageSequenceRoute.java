package com.example.eip.metadata;

import java.util.*;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class MessageSequenceRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Splits a bulk order into individual line items, each tagged with
        // CamelSplitIndex (position) and CamelSplitSize (total count)
        from("kafka:eip.metadata.bulk-orders?brokers={{kafka.brokers}}&groupId=sequence-demo")
            .routeId("message-sequence-splitter")
            .unmarshal().json()
            .log("Bulk order ${body[bulk_order_id]} received — splitting ${body[items].size()} items")
            .setHeader("BulkOrderId", simple("${body[bulk_order_id]}"))
            .split(simple("${body[items]}"))
                .log("Split item ${header.CamelSplitIndex} of ${header.CamelSplitSize}: ${body}")
                .marshal().json()
                .to("kafka:eip.metadata.line-items?brokers={{kafka.brokers}}")
            .end();

        // Aggregates the line items back by bulk-order ID once all items arrive
        from("kafka:eip.metadata.line-items?brokers={{kafka.brokers}}&groupId=sequence-aggregator")
            .routeId("message-sequence-aggregator")
            .unmarshal().json()
            .log("Line item received — sequence ${header.CamelSplitIndex} of ${header.CamelSplitSize} for ${header.BulkOrderId}")
            .aggregate(header("BulkOrderId"), new LineItemAggregationStrategy())
                .completionSize(header("CamelSplitSize"))
                .completionTimeout(30000)
                .log("Aggregated ${body.size()} line items for bulk order ${header.BulkOrderId}")
                .marshal().json()
                .to("kafka:eip.metadata.orders.reassembled?brokers={{kafka.brokers}}")
            .end();
    }

    private static class LineItemAggregationStrategy implements AggregationStrategy {

        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            if (oldExchange == null) {
                var list = new ArrayList<>();
                list.add(newExchange.getIn().getBody());
                newExchange.getIn().setBody(list);
                return newExchange;
            }
            @SuppressWarnings("unchecked")
            var list = oldExchange.getIn().getBody(List.class);
            list.add(newExchange.getIn().getBody());
            return oldExchange;
        }
    }
}
