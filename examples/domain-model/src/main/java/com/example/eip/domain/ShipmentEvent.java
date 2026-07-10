package com.example.eip.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record ShipmentEvent(
    @JsonProperty("shipment_id") String shipmentId,
    @JsonProperty("order_id") long orderId,
    @JsonProperty("carrier") String carrier,
    @JsonProperty("tracking_number") String trackingNumber,
    @JsonProperty("status") String status,
    @JsonProperty("destination_country") String destinationCountry,
    @JsonProperty("weight_kg") double weightKg,
    @JsonProperty("contains_hazmat") boolean containsHazmat,
    @JsonProperty("timestamp") Instant timestamp
) {}
