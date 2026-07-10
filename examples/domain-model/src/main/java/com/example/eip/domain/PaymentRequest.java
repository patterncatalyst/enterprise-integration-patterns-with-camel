package com.example.eip.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record PaymentRequest(
    @JsonProperty("payment_id") String paymentId,
    @JsonProperty("order_id") long orderId,
    @JsonProperty("customer_id") String customerId,
    @JsonProperty("amount") double amount,
    @JsonProperty("currency") String currency,
    @JsonProperty("method") String method,
    @JsonProperty("status") String status,
    @JsonProperty("requested_at") Instant requestedAt
) {
    public PaymentRequest {
        if (currency == null) currency = "USD";
        if (status == null) status = "PENDING";
    }
}
