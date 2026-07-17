package com.example.eip.management;

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.model.dataformat.JsonLibrary;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Messaging Mapper pattern — maps between the wire format (JSON on Kafka)
 * and typed domain objects so route logic works with real POJOs instead of
 * raw strings or generic maps.
 *
 * Uses {@code unmarshal().json(Order.class)} to deserialise and a
 * {@link OrderService} bean for domain processing.
 */
@Component
public class MessagingMapperRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.clean?brokers={{kafka.brokers}}&groupId=messaging-mapper-demo")
            .routeId("messaging-mapper")
            .log("Messaging Mapper — raw JSON received")
            .unmarshal().json(JsonLibrary.Jackson, Order.class)
            .log("Mapped to Order object: ${body}")
            .bean(OrderService.class, "process")
            .log("OrderService result: ${body}");
    }

    /** Simple domain object for order data. */
    public static class Order {
        private long order_id;
        private String customer_id;
        private String item_sku;
        private int quantity;
        private double amount;
        private String destination_country;
        private boolean contains_hazmat;
        private String shipping_priority;
        private long timestamp;

        public Order() {}

        public long getOrder_id() { return order_id; }
        public void setOrder_id(long order_id) { this.order_id = order_id; }

        public String getCustomer_id() { return customer_id; }
        public void setCustomer_id(String customer_id) { this.customer_id = customer_id; }

        public String getItem_sku() { return item_sku; }
        public void setItem_sku(String item_sku) { this.item_sku = item_sku; }

        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }

        public double getAmount() { return amount; }
        public void setAmount(double amount) { this.amount = amount; }

        public String getDestination_country() { return destination_country; }
        public void setDestination_country(String destination_country) { this.destination_country = destination_country; }

        public boolean isContains_hazmat() { return contains_hazmat; }
        public void setContains_hazmat(boolean contains_hazmat) { this.contains_hazmat = contains_hazmat; }

        public String getShipping_priority() { return shipping_priority; }
        public void setShipping_priority(String shipping_priority) { this.shipping_priority = shipping_priority; }

        public long getTimestamp() { return timestamp; }
        public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

        @Override
        public String toString() {
            return "Order{id=%d, customer='%s', sku='%s', qty=%d, amount=%.2f, country='%s', hazmat=%s, priority='%s'}"
                .formatted(order_id, customer_id, item_sku, quantity, amount,
                           destination_country, contains_hazmat, shipping_priority);
        }
    }

    /** Domain service that processes mapped Order objects. */
    @Component
    public static class OrderService {

        private static final Logger LOG = LoggerFactory.getLogger(OrderService.class);

        public String process(Order order) {
            LOG.info("Processing typed order {} for customer {} — {} x {} @ ${} ({})",
                     order.getOrder_id(),
                     order.getCustomer_id(),
                     order.getQuantity(),
                     order.getItem_sku(),
                     order.getAmount(),
                     order.getShipping_priority());

            // Simulate domain processing
            String status = order.getAmount() > 200 ? "FLAGGED_FOR_REVIEW" : "APPROVED";
            LOG.info("Order {} → {}", order.getOrder_id(), status);

            return """
                {"order_id": %d, "status": "%s", "processed_at": %d}
                """.formatted(order.getOrder_id(), status, System.currentTimeMillis());
        }
    }
}
