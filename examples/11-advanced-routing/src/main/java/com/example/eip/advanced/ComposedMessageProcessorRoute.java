package com.example.eip.advanced;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class ComposedMessageProcessorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.composed?brokers={{kafka.brokers}}&groupId=composed-msg-demo")
            .routeId("composed-message-processor")
            .unmarshal().json()
            .log("Composed Message Processor received order ${body[order_id]} with line items")
            .setHeader("originalOrderId", jsonpath("$.order_id"))
            .setHeader("originalCustomerId", jsonpath("$.customer_id"))
            .split(jsonpath("$.line_items"))
                .parallelProcessing()
                .streaming()
                .aggregationStrategy(new LineItemAggregationStrategy())
                .to("direct:process-line-item")
            .end()
            .log("All line items processed for order ${header.originalOrderId}, total: $${header.orderTotal}")
            .marshal().json()
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}");

        from("direct:process-line-item")
            .routeId("process-line-item")
            .log("Processing line item: ${body[sku]}")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var item = exchange.getIn().getBody(Map.class);
                int quantity = ((Number) item.get("quantity")).intValue();
                double unitPrice = ((Number) item.get("unit_price")).doubleValue();
                double lineTotal = quantity * unitPrice;

                var enriched = new LinkedHashMap<>(item);
                enriched.put("line_total", lineTotal);
                enriched.put("validated", true);
                enriched.put("in_stock", true);
                exchange.getIn().setBody(enriched);
            })
            .log("Line item ${body[sku]}: qty=${body[quantity]} x $${body[unit_price]} = $${body[line_total]}");
    }

    static class LineItemAggregationStrategy implements AggregationStrategy {

        @Override
        @SuppressWarnings("unchecked")
        public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
            var processedItem = newExchange.getIn().getBody(Map.class);

            if (oldExchange == null) {
                var result = new LinkedHashMap<String, Object>();
                result.put("order_id", newExchange.getIn().getHeader("originalOrderId"));
                result.put("customer_id", newExchange.getIn().getHeader("originalCustomerId"));

                List<Map<String, Object>> items = new ArrayList<>();
                items.add(processedItem);
                result.put("line_items", items);

                double lineTotal = ((Number) processedItem.get("line_total")).doubleValue();
                result.put("order_total", lineTotal);

                newExchange.getIn().setBody(result);
                newExchange.getIn().setHeader("orderTotal",
                    String.format("%.2f", lineTotal));
                return newExchange;
            }

            var aggregated = oldExchange.getIn().getBody(Map.class);
            ((List<Map<String, Object>>) aggregated.get("line_items")).add(processedItem);

            double currentTotal = ((Number) aggregated.get("order_total")).doubleValue();
            double lineTotal = ((Number) processedItem.get("line_total")).doubleValue();
            double newTotal = currentTotal + lineTotal;
            aggregated.put("order_total", newTotal);
            oldExchange.getIn().setHeader("orderTotal",
                String.format("%.2f", newTotal));

            return oldExchange;
        }
    }
}
