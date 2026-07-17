package com.example.eip.testing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * Managed Channel Adapter with Circuit Breaker — wraps calls to an
 * external inventory service in a circuit breaker.  When the service
 * is unavailable (simulated by failing every 3rd request), the circuit
 * opens and the fallback routes the message to a dead-letter queue
 * for later retry.
 */
@Component
public class ManagedAdapterRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.processed?brokers={{kafka.brokers}}&groupId=managed-adapter-demo")
            .routeId("managed-adapter-circuit-breaker")
            .unmarshal().json()
            .log("Managed Adapter: checking inventory for order ${body[order_id]}")
            .circuitBreaker()
                .to("direct:inventory-check")
            .onFallback()
                .log("Circuit OPEN: routing order ${body[order_id]} to DLQ for retry")
                .marshal().json()
                .to("kafka:eip.orders.dlq?brokers={{kafka.brokers}}")
            .end()
            .log("Managed Adapter: order ${body[order_id]} processed successfully");

        // Simulated external inventory service — fails every 3rd call
        from("direct:inventory-check")
            .routeId("managed-adapter-inventory-check")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var body = exchange.getIn().getBody(java.util.Map.class);
                Number orderId = (Number) body.get("order_id");
                long id = orderId != null ? orderId.longValue() : 0;

                // Simulate intermittent failure
                if (id % 3 == 0) {
                    throw new RuntimeException(
                        "Inventory service unavailable for order " + id);
                }

                body.put("inventory_status", "IN_STOCK");
                body.put("warehouse_location", "WH-CENTRAL-02");
                exchange.getIn().setBody(body);
            })
            .log("Inventory check passed for order ${body[order_id]}: ${body[inventory_status]}")
            .marshal().json()
            .to("kafka:eip.orders.inventory-checked?brokers={{kafka.brokers}}");
    }
}
