package com.example.eip.drools;

public class Order {

    private long orderId;
    private String customerId;
    private double amount;
    private String destinationCountry;
    private boolean containsHazmat;
    private String routingDecision;

    public long getOrderId() {
        return orderId;
    }

    public void setOrderId(long orderId) {
        this.orderId = orderId;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public String getDestinationCountry() {
        return destinationCountry;
    }

    public void setDestinationCountry(String destinationCountry) {
        this.destinationCountry = destinationCountry;
    }

    public boolean isContainsHazmat() {
        return containsHazmat;
    }

    public void setContainsHazmat(boolean containsHazmat) {
        this.containsHazmat = containsHazmat;
    }

    public String getRoutingDecision() {
        return routingDecision;
    }

    public void setRoutingDecision(String routingDecision) {
        this.routingDecision = routingDecision;
    }
}
