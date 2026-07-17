package com.example.eip.bondtrading.model;

public record CanonicalPrice(String isin, String issuer, String bondType, double bidPrice,
                             double askPrice, double bidYield, double askYield,
                             String bestSource, long timestamp) {}
