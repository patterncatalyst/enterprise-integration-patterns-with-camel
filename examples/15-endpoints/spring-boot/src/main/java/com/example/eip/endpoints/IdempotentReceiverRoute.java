package com.example.eip.endpoints;

import javax.sql.DataSource;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.processor.idempotent.jdbc.JdbcMessageIdRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Idempotent Receiver — deduplicates messages using a JDBC-backed
 * repository in PostgreSQL.  Duplicate order IDs are silently skipped.
 */
@Component
public class IdempotentReceiverRoute extends RouteBuilder {

    @Autowired
    DataSource dataSource;

    @Override
    public void configure() {
        JdbcMessageIdRepository idempotentRepo =
            new JdbcMessageIdRepository(dataSource, "payment-dedup");

        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=idempotent-demo")
            .routeId("idempotent-receiver")
            .unmarshal().json()
            .idempotentConsumer(jsonpath("$.order_id"), idempotentRepo)
            .log("Processing unique order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.deduplicated?brokers={{kafka.brokers}}");
    }
}
