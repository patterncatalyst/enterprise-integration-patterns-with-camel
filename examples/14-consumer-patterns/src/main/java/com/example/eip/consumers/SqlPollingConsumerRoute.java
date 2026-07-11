package com.example.eip.consumers;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * SQL Polling Consumer — pulls rows from PostgreSQL on a schedule,
 * marks them as processing, and publishes them to Kafka.
 */
@ApplicationScoped
public class SqlPollingConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("sql:SELECT * FROM orders.orders WHERE status = 'PLACED' "
                + "ORDER BY created_at LIMIT 10"
                + "?delay=30000"
                + "&onConsume=UPDATE orders.orders SET status = 'PROCESSING' WHERE id = :#id")
            .routeId("polling-consumer-sql")
            .log("SQL Polling Consumer — processing order from DB: "
                + "id=${body[id]}, customer=${body[customer_id]}, sku=${body[item_sku]}")
            .marshal().json()
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}");
    }
}
