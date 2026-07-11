package com.example.eip.flow;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Named;

import org.apache.camel.Exchange;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
@Named("orderSagaManager")
public class OrderSagaManager {

    private final Map<Long, OrderFulfillmentState> sagaStates = new ConcurrentHashMap<>();

    public void startSaga(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        long orderId = ((Number) order.get("order_id")).longValue();
        sagaStates.put(orderId, OrderFulfillmentState.RECEIVED);
        exchange.getIn().setHeader("sagaState", OrderFulfillmentState.RECEIVED.name());
    }

    public void reserveInventory(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        long orderId = ((Number) order.get("order_id")).longValue();
        double amount = ((Number) order.get("amount")).doubleValue();

        if (amount > 5000) {
            sagaStates.put(orderId, OrderFulfillmentState.FAILED);
            exchange.getIn().setHeader("sagaState", OrderFulfillmentState.FAILED.name());
            exchange.getIn().setHeader("failureReason", "Inventory unavailable for high-value order");
            return;
        }

        sagaStates.put(orderId, OrderFulfillmentState.INVENTORY_RESERVED);
        exchange.getIn().setHeader("sagaState", OrderFulfillmentState.INVENTORY_RESERVED.name());
    }

    public void authorizePayment(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        long orderId = ((Number) order.get("order_id")).longValue();

        boolean fraudulent = orderId % 7 == 0;
        if (fraudulent) {
            sagaStates.put(orderId, OrderFulfillmentState.COMPENSATION_INVENTORY);
            exchange.getIn().setHeader("sagaState", OrderFulfillmentState.COMPENSATION_INVENTORY.name());
            exchange.getIn().setHeader("failureReason", "Payment declined — suspected fraud");
            return;
        }

        sagaStates.put(orderId, OrderFulfillmentState.PAYMENT_AUTHORIZED);
        exchange.getIn().setHeader("sagaState", OrderFulfillmentState.PAYMENT_AUTHORIZED.name());
    }

    public void shipOrder(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        long orderId = ((Number) order.get("order_id")).longValue();
        sagaStates.put(orderId, OrderFulfillmentState.SHIPPED);
        exchange.getIn().setHeader("sagaState", OrderFulfillmentState.SHIPPED.name());
    }

    public void compensateInventory(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        long orderId = ((Number) order.get("order_id")).longValue();
        sagaStates.put(orderId, OrderFulfillmentState.FAILED);
        exchange.getIn().setHeader("sagaState", OrderFulfillmentState.FAILED.name());
    }

    public OrderFulfillmentState getState(long orderId) {
        return sagaStates.getOrDefault(orderId, null);
    }
}
