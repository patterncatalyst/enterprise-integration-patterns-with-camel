package com.example.eip.bondtrading;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.support.processor.idempotent.MemoryIdempotentRepository;

import java.util.Map;

/**
 * Trade validation route — consumes new trade orders, deduplicates by orderId,
 * validates basic constraints, wire taps to an audit log, and forwards valid
 * orders downstream.
 */
@ApplicationScoped
public class TradeValidationRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:bond.orders.new?brokers={{kafka.brokers}}&groupId=trade-validator")
            .routeId("trade-validator")
            .unmarshal().json(Map.class)
            .log("Received order: ${body[orderId]} — ${body[side]} ${body[quantity]} ${body[isin]} @ ${body[limitPrice]}")
            .idempotentConsumer(simple("${body[orderId]}"), MemoryIdempotentRepository.memoryIdempotentRepository(200))
            .process(exchange -> {
                var order = exchange.getIn().getBody(Map.class);
                double limitPrice = ((Number) order.get("limitPrice")).doubleValue();
                int quantity = ((Number) order.get("quantity")).intValue();

                if (limitPrice < 0) {
                    exchange.getIn().setHeader("ValidationResult", "REJECTED");
                    exchange.getIn().setHeader("RejectionReason", "Negative limit price");
                } else if (quantity <= 0) {
                    exchange.getIn().setHeader("ValidationResult", "REJECTED");
                    exchange.getIn().setHeader("RejectionReason", "Quantity must be positive");
                } else {
                    exchange.getIn().setHeader("ValidationResult", "VALID");
                }
            })
            .wireTap("kafka:bond.audit.log?brokers={{kafka.brokers}}")
            .choice()
                .when(header("ValidationResult").isEqualTo("VALID"))
                    .log("Order ${body[orderId]} validated — forwarding to execution")
                    .marshal().json()
                    .to("kafka:bond.orders.validated?brokers={{kafka.brokers}}")
                .otherwise()
                    .log("Order ${body[orderId]} REJECTED: ${header.RejectionReason}")
            .end();
    }
}
