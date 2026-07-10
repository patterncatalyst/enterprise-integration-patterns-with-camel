---
title: "Appendix F: Drools and Business Rules"
order: 24
part: appendices
description: "Rule units, decision tables, and integrating Drools 10 with Camel routes for externalized business logic."
duration: "25 minutes"
---

Several EIP patterns — Content-Based Router, Message Filter, Dynamic Router — make decisions based on business rules. When those rules change frequently (pricing tiers, fraud thresholds, routing logic), embedding them in Java code means redeploying for every rule change. Drools externalizes rules so business analysts can modify them without developer intervention.

## Why Drools for integration

| Concern | Hardcoded in Java | Externalized in Drools |
|---------|------------------|----------------------|
| Changing a threshold | Code change + deploy | Rule file update + reload |
| Audit trail | Git diff | Rule versioning + execution log |
| Business ownership | Developers own the logic | Business analysts can review/modify |
| Testing | JUnit per branch | Rule unit tests + decision table coverage |

## Drools 10 with Camel Quarkus

Drools 10 uses **Rule Units** — self-contained rule sets with typed data sources:

### Define a rule unit

```java
// The data model
public class Order {
    private long orderId;
    private String customerId;
    private double amount;
    private String destinationCountry;
    private boolean containsHazmat;
    private String routingDecision;
    // getters, setters
}

// The rule unit
public class OrderRoutingUnit implements RuleUnitData {
    private DataStore<Order> orders;

    public DataStore<Order> getOrders() {
        return orders;
    }
}
```

### Write rules in DRL

```drl
// src/main/resources/com/example/rules/order-routing.drl
unit OrderRoutingUnit;

rule "Route hazmat orders to hazmat handler"
when
    $o: /orders[containsHazmat == true, routingDecision == null]
then
    $o.setRoutingDecision("hazmat");
end

rule "Route high-value international to fraud review"
when
    $o: /orders[amount >= 10000, destinationCountry != "US", routingDecision == null]
then
    $o.setRoutingDecision("fraud-review-international");
end

rule "Route express orders to priority queue"
when
    $o: /orders[amount >= 500, routingDecision == null]
then
    $o.setRoutingDecision("express");
end

rule "Default routing"
when
    $o: /orders[routingDecision == null]
then
    $o.setRoutingDecision("standard");
end
```

### Integrate with Camel

```java
@ApplicationScoped
@Named("ruleBasedRouter")
public class RuleBasedRouter {

    @Inject
    RuleUnitInstance<OrderRoutingUnit> ruleUnit;

    public void route(Exchange exchange) {
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        Order order = new Order();
        order.setOrderId(((Number) body.get("order_id")).longValue());
        order.setAmount(((Number) body.get("amount")).doubleValue());
        order.setDestinationCountry((String) body.get("destination_country"));
        order.setContainsHazmat(Boolean.TRUE.equals(body.get("contains_hazmat")));

        ruleUnit.getUnit().getOrders().add(order);
        ruleUnit.fire();

        exchange.getIn().setHeader("routingDecision", order.getRoutingDecision());
    }
}

// Camel route that uses the rule engine
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=rule-router")
    .routeId("drools-content-based-router")
    .unmarshal().json(Map.class)
    .bean("ruleBasedRouter", "route")
    .log("Rule engine decided: ${header.routingDecision}")
    .toD("direct:${header.routingDecision}");
```

## Decision tables

For rules that business analysts manage, decision tables in spreadsheets are more accessible than DRL files:

| Rule Name | Amount Min | Amount Max | Country | Hazmat | Routing Decision |
|-----------|-----------|-----------|---------|--------|-----------------|
| Hazmat | — | — | — | true | hazmat |
| High-value intl | 10000 | — | != US | — | fraud-review |
| Express | 500 | — | — | — | express |
| Standard | — | — | — | — | standard |

Export as a `.xls` or `.csv` decision table and Drools compiles it into rules. Business analysts update the spreadsheet; the application picks up changes on reload.

## Dependencies

```xml
<dependency>
    <groupId>org.drools</groupId>
    <artifactId>drools-quarkus</artifactId>
    <version>10.2.0</version>
</dependency>
<dependency>
    <groupId>org.drools</groupId>
    <artifactId>drools-quarkus-rules</artifactId>
    <version>10.2.0</version>
</dependency>
```

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Drools 10 uses `RuleUnitData` and `DataStore` for rule units; `drools-quarkus` extension exists for Quarkus integration; DRL `unit` directive syntax is correct; rule unit injection with `@Inject RuleUnitInstance` works in Quarkus.*
