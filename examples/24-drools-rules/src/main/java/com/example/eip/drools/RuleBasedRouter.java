package com.example.eip.drools;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;

import org.apache.camel.Exchange;
import org.drools.ruleunits.api.RuleUnit;
import org.drools.ruleunits.api.RuleUnitInstance;

import java.util.Map;

@ApplicationScoped
@Named("ruleBasedRouter")
public class RuleBasedRouter {

    @Inject
    RuleUnit<OrderRoutingUnit> ruleUnit;

    public void evaluate(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);

        Order order = new Order();
        order.setOrderId(((Number) body.get("order_id")).longValue());
        order.setCustomerId(String.valueOf(body.get("customer_id")));
        order.setAmount(((Number) body.get("amount")).doubleValue());
        order.setDestinationCountry((String) body.getOrDefault("destination_country", "US"));
        order.setContainsHazmat(Boolean.TRUE.equals(body.get("contains_hazmat")));

        OrderRoutingUnit unitData = new OrderRoutingUnit();
        unitData.getOrders().add(order);

        try (RuleUnitInstance<OrderRoutingUnit> instance = ruleUnit.createInstance(unitData)) {
            instance.fire();
        }

        exchange.getIn().setHeader("routingDecision", order.getRoutingDecision());
    }
}
