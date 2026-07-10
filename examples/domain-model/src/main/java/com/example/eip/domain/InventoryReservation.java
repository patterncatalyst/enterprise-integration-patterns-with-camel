package com.example.eip.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record InventoryReservation(
    @JsonProperty("reservation_id") String reservationId,
    @JsonProperty("order_id") long orderId,
    @JsonProperty("item_sku") String itemSku,
    @JsonProperty("quantity") int quantity,
    @JsonProperty("warehouse") String warehouse,
    @JsonProperty("status") String status,
    @JsonProperty("reserved_at") Instant reservedAt
) {}
