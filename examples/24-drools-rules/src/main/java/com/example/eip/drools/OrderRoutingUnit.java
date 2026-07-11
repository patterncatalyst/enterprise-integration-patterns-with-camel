package com.example.eip.drools;

import org.drools.ruleunits.api.DataSource;
import org.drools.ruleunits.api.DataStore;
import org.drools.ruleunits.api.RuleUnitData;

public class OrderRoutingUnit implements RuleUnitData {

    private final DataStore<Order> orders = DataSource.createStore();

    public DataStore<Order> getOrders() {
        return orders;
    }
}
