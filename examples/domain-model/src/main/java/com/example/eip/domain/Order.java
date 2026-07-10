package com.example.eip.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record Order(
    @JsonProperty("order_id") long orderId,
    @JsonProperty("customer_id") String customerId,
    @JsonProperty("item_sku") String itemSku,
    @JsonProperty("quantity") int quantity,
    @JsonProperty("amount") double amount,
    @JsonProperty("destination_country") String destinationCountry,
    @JsonProperty("destination_address") String destinationAddress,
    @JsonProperty("shipping_priority") String shippingPriority,
    @JsonProperty("contains_hazmat") boolean containsHazmat,
    @JsonProperty("status") String status,
    @JsonProperty("created_at") Instant createdAt
) {
    public Order {
        if (status == null) status = "NEW";
        if (shippingPriority == null) shippingPriority = "STANDARD";
        if (createdAt == null) createdAt = Instant.now();
    }
}
