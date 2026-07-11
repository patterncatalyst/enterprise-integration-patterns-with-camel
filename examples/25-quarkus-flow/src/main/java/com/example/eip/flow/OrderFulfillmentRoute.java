package com.example.eip.flow;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderFulfillmentRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("timer:saga-order-gen?period=5000")
            .routeId("saga-order-generator")
            .process(exchange -> {
                long orderId = 12000 + (System.nanoTime() % 100);
                double amount = 29.99 * (1 + orderId % 10);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 50, amount));
            })
            .to("kafka:eip.orders.saga?brokers={{kafka.brokers}}");

        from("kafka:eip.orders.saga?brokers={{kafka.brokers}}&groupId=saga-orchestrator")
            .routeId("saga-orchestrator")
            .unmarshal().json(java.util.Map.class)
            .bean("orderSagaManager", "startSaga")
            .log("Saga started for order ${body[order_id]} — state: ${header.sagaState}")
            .to("direct:saga-reserve-inventory");

        from("direct:saga-reserve-inventory")
            .routeId("saga-reserve-inventory")
            .bean("orderSagaManager", "reserveInventory")
            .log("Inventory step for order ${body[order_id]} — state: ${header.sagaState}")
            .choice()
                .when(header("sagaState").isEqualTo("FAILED"))
                    .log("Saga FAILED at inventory for order ${body[order_id]}: ${header.failureReason}")
                    .to("kafka:eip.orders.saga-failed?brokers={{kafka.brokers}}")
                .otherwise()
                    .to("direct:saga-authorize-payment")
            .end();

        from("direct:saga-authorize-payment")
            .routeId("saga-authorize-payment")
            .bean("orderSagaManager", "authorizePayment")
            .log("Payment step for order ${body[order_id]} — state: ${header.sagaState}")
            .choice()
                .when(header("sagaState").isEqualTo("COMPENSATION_INVENTORY"))
                    .log("Payment declined for order ${body[order_id]} — compensating inventory")
                    .bean("orderSagaManager", "compensateInventory")
                    .marshal().json()
                    .to("kafka:eip.orders.saga-failed?brokers={{kafka.brokers}}")
                .otherwise()
                    .to("direct:saga-ship-order")
            .end();

        from("direct:saga-ship-order")
            .routeId("saga-ship-order")
            .bean("orderSagaManager", "shipOrder")
            .log("Order ${body[order_id]} SHIPPED — saga completed successfully")
            .marshal().json()
            .to("kafka:eip.orders.saga-completed?brokers={{kafka.brokers}}");

        from("kafka:eip.orders.saga-completed?brokers={{kafka.brokers}}&groupId=saga-monitor")
            .routeId("saga-completion-monitor")
            .log("Saga COMPLETED: ${body}");

        from("kafka:eip.orders.saga-failed?brokers={{kafka.brokers}}&groupId=saga-monitor")
            .routeId("saga-failure-monitor")
            .log("Saga FAILED: ${body}");
    }
}
