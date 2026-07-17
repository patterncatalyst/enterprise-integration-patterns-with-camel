package com.example.eip.metadata;

import java.time.Instant;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class MessageExpirationRoute extends RouteBuilder {

    private static final long TTL_MILLIS = 30_000; // 30-second TTL for demo purposes

    @Override
    public void configure() {
        // Producer: stamps creation and expiration timestamps on each order
        from("kafka:eip.metadata.orders?brokers={{kafka.brokers}}&groupId=expiration-producer")
            .routeId("message-expiration-producer")
            .process(exchange -> {
                long now = Instant.now().toEpochMilli();
                exchange.getIn().setHeader("messageCreatedAt", now);
                exchange.getIn().setHeader("messageExpiresAt", now + TTL_MILLIS);
            })
            .log("Stamped expiration — created=${header.messageCreatedAt}, expires=${header.messageExpiresAt}")
            .to("kafka:eip.metadata.orders.expiring?brokers={{kafka.brokers}}");

        // Consumer: checks whether the message has expired before processing
        from("kafka:eip.metadata.orders.expiring?brokers={{kafka.brokers}}&groupId=expiration-consumer")
            .routeId("message-expiration-consumer")
            .process(exchange -> {
                long expiresAt = exchange.getIn().getHeader("messageExpiresAt", Long.class);
                boolean expired = Instant.now().toEpochMilli() > expiresAt;
                exchange.getIn().setHeader("messageExpired", expired);
            })
            .choice()
                .when(header("messageExpired").isEqualTo(true))
                    .log("EXPIRED order dropped (created=${header.messageCreatedAt}, expired=${header.messageExpiresAt})")
                    .to("kafka:eip.metadata.orders.dead?brokers={{kafka.brokers}}")
                .otherwise()
                    .log("Order within TTL — processing normally")
                    .unmarshal().json()
                    .log("Processing order ${body[order_id]} (expires in ${header.messageExpiresAt} epoch-ms)")
                    .to("kafka:eip.metadata.orders.fulfilled?brokers={{kafka.brokers}}")
            .end();
    }
}
