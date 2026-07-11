package com.example.eip.flow;

public enum OrderFulfillmentState {
    RECEIVED,
    INVENTORY_RESERVED,
    PAYMENT_AUTHORIZED,
    SHIPPED,
    COMPLETED,
    COMPENSATION_INVENTORY,
    COMPENSATION_PAYMENT,
    FAILED
}
