package com.example.eip.loanbroker.model;

public record BankQuote(String requestId, String bankId, String bankName, double interestRate, double monthlyPayment, boolean approved) {}
