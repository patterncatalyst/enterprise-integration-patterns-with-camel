package com.example.eip.drools;

import org.springframework.stereotype.Component;

import org.apache.camel.Exchange;
import org.kie.api.KieServices;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;

import java.util.Map;

@Component("ruleBasedRouter")
public class RuleBasedRouter {

    private final KieContainer kieContainer;

    public RuleBasedRouter() {
        KieServices ks = KieServices.Factory.get();
        this.kieContainer = ks.getKieClasspathContainer();
    }

    public void evaluate(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> body = exchange.getIn().getBody(Map.class);

        Order order = new Order();
        order.setOrderId(((Number) body.get("order_id")).longValue());
        order.setCustomerId(String.valueOf(body.get("customer_id")));
        order.setAmount(((Number) body.get("amount")).doubleValue());
        order.setDestinationCountry((String) body.getOrDefault("destination_country", "US"));
        order.setContainsHazmat(Boolean.TRUE.equals(body.get("contains_hazmat")));

        KieSession session = kieContainer.newKieSession();
        try {
            session.insert(order);
            session.fireAllRules();
        } finally {
            session.dispose();
        }

        exchange.getIn().setHeader("routingDecision", order.getRoutingDecision());
    }
}
