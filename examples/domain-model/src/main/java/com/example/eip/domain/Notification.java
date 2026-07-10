package com.example.eip.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.Map;

public record Notification(
    @JsonProperty("notification_id") String notificationId,
    @JsonProperty("order_id") long orderId,
    @JsonProperty("customer_id") String customerId,
    @JsonProperty("channel") String channel,
    @JsonProperty("template") String template,
    @JsonProperty("parameters") Map<String, String> parameters,
    @JsonProperty("sent_at") Instant sentAt
) {}
