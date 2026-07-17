package com.example.eip.aggregator;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import java.util.*;

@ApplicationScoped
public class AggregatorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.line-items?brokers={{kafka.brokers}}&groupId=aggregator-demo")
            .routeId("order-aggregator")
            .unmarshal().json()
            .log("Received line item for order ${body[order_id]}: ${body[item_sku]}")
            .aggregate(jsonpath("$.order_id"), new OrderAggregationStrategy())
                .completionSize(3)
                .completionTimeout(10000)
            .log("Aggregated complete order ${body[order_id]} with ${body[line_items].size} items, total=${body[total_amount]}")
            .marshal().json()
            .to("kafka:eip.orders.complete?brokers={{kafka.brokers}}");
    }

    private static class OrderAggregationStrategy implements AggregationStrategy {

        @Override
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            var lineItem = newExchange.getIn().getBody(Map.class);

            if (oldExchange == null) {
                var order = new LinkedHashMap<String, Object>();
                order.put("order_id", lineItem.get("order_id"));
                order.put("customer_id", lineItem.get("customer_id"));
                order.put("line_items", new ArrayList<>(List.of(Map.of(
                    "item_sku", lineItem.get("item_sku"),
                    "quantity", lineItem.get("quantity"),
                    "price", lineItem.get("price")
                ))));
                order.put("total_amount", ((Number) lineItem.get("price")).doubleValue());
                order.put("status", "ASSEMBLED");
                newExchange.getIn().setBody(order);
                return newExchange;
            }

            var order = oldExchange.getIn().getBody(Map.class);
            var items = (List<Map<String, Object>>) order.get("line_items");
            items.add(Map.of(
                "item_sku", lineItem.get("item_sku"),
                "quantity", lineItem.get("quantity"),
                "price", lineItem.get("price")
            ));
            double total = ((Number) order.get("total_amount")).doubleValue()
                + ((Number) lineItem.get("price")).doubleValue();
            order.put("total_amount", total);
            return oldExchange;
        }
    }
}
