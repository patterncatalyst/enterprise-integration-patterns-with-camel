package com.example.eip.aggregator;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;
import jakarta.enterprise.inject.Produces;
import javax.sql.DataSource;

import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.processor.aggregate.jdbc.PostgresAggregationRepository;
import java.util.*;

/**
 * Persistent Aggregator — same aggregation logic as the in-memory
 * AggregatorRoute, but backed by a PostgreSQL JdbcAggregationRepository
 * so in-flight aggregations survive restarts.
 */
@ApplicationScoped
public class PersistentAggregatorRoute extends RouteBuilder {

    @Produces
    @ApplicationScoped
    @Named("jdbcAggregationRepo")
    public PostgresAggregationRepository aggregationRepo(DataSource dataSource) {
        PostgresAggregationRepository repo = new PostgresAggregationRepository();
        repo.setDataSource(dataSource);
        repo.setRepositoryName("camel_aggregation");
        repo.setStoreBodyAsText(true);
        return repo;
    }

    @Override
    public void configure() {
        from("kafka:eip.orders.line-items?brokers={{kafka.brokers}}&groupId=persistent-aggregator-demo")
            .routeId("persistent-order-aggregator")
            .unmarshal().json()
            .log("Persistent aggregator received line item for order ${body[order_id]}: ${body[item_sku]}")
            .aggregate(jsonpath("$.order_id"), new PersistentOrderAggregationStrategy())
                .completionSize(3)
                .completionTimeout(15000)
                .aggregationRepository("#jdbcAggregationRepo")
            .log("Persistent aggregator — complete order ${body[order_id]} with ${body[line_items].size} items")
            .marshal().json()
            .to("kafka:eip.orders.complete-persistent?brokers={{kafka.brokers}}");
    }

    private static class PersistentOrderAggregationStrategy implements AggregationStrategy {

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
                order.put("persistent", true);
                newExchange.getIn().setBody(order);
                return newExchange;
            }

            var order = oldExchange.getIn().getBody(Map.class);
            @SuppressWarnings("unchecked")
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
