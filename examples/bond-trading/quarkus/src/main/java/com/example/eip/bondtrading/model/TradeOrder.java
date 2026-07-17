package com.example.eip.bondtrading.model;

public record TradeOrder(String orderId, String portfolioId, String isin, String side,
                         int quantity, double limitPrice, String orderType) {}
