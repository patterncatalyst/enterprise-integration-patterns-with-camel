package com.example.eip.loanbroker.model;

public record LoanRequest(String requestId, String customerId, double amount, int termMonths, int creditScore) {}
