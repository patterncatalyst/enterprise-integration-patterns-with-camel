package com.example.eip.bondtrading.model;

public record RawPriceUpdate(String source, String bondId, double bidPrice, double askPrice,
                             int bidSize, int askSize, long sourceTimestamp) {}
