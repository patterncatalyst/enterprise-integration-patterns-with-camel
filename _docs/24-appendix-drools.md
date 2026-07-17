---
title: "Appendix F: Drools and Business Rules"
order: 24
part: appendices
description: "Rule units, decision tables, and integrating Drools 10 with Camel routes for externalized business logic."
duration: "25 minutes"
---

Several EIP patterns — Content-Based Router, Message Filter, Dynamic Router — make decisions based on business rules. When those rules change frequently (pricing tiers, fraud thresholds, routing logic), embedding them in Java code means redeploying for every rule change. Drools externalizes rules so business analysts can modify them without developer intervention.

The code is in `examples/24-drools-rules/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/24-drools-rules/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/24-drools-rules/spring-boot
mvn spring-boot:run
```

{% include excalidraw.html file="24-appendix-drools" alt="Drools rule-based content router: Kafka consumer to rule engine to routing destinations" caption="Figure F.1 — A Drools Rule Unit evaluates orders against DRL rules and decision tables, setting a routing decision that Camel's toD() uses to dispatch to the correct handler." %}

## Why Drools for integration

| Concern | Hardcoded in Java | Externalized in Drools |
|---------|------------------|----------------------|
| Changing a threshold | Code change + deploy | Rule file update + reload |
| Audit trail | Git diff | Rule versioning + execution log |
| Business ownership | Developers own the logic | Business analysts can review/modify |
| Testing | JUnit per branch | Rule unit tests + decision table coverage |

## Drools 10 with Camel Quarkus

Drools 10 uses the classic **KIE Session** API — create a `KieContainer` from the classpath, insert facts, fire rules:

### Define the data model

```java
public class Order {
    private long orderId;
    private String customerId;
    private double amount;
    private String destinationCountry;
    private boolean containsHazmat;
    private String routingDecision;
    // getters, setters
}
```

### Write rules in DRL

```drl
// src/main/resources/com/example/eip/drools/order-routing.drl
package com.example.eip.drools;

import com.example.eip.drools.Order;

rule "Route hazmat orders to hazmat handler"
    salience 40
when
    $o: Order(containsHazmat == true, routingDecision == null)
then
    $o.setRoutingDecision("hazmat");
end

rule "Route high-value international to fraud review"
    salience 30
when
    $o: Order(amount >= 10000, destinationCountry != "US", routingDecision == null)
then
    $o.setRoutingDecision("fraud-review");
end

rule "Route express orders to priority queue"
    salience 20
when
    $o: Order(amount >= 500, routingDecision == null)
then
    $o.setRoutingDecision("express");
end

rule "Default routing"
    salience 10
when
    $o: Order(routingDecision == null)
then
    $o.setRoutingDecision("standard");
end
```

Add a `META-INF/kmodule.xml` to register the rule packages:

```xml
<kmodule xmlns="http://www.drools.org/xsd/kmodule">
    <kbase name="orderRules" packages="com.example.eip.drools">
        <ksession name="orderSession"/>
    </kbase>
</kmodule>
```

### Integrate with Camel

```java
@ApplicationScoped
@Named("ruleBasedRouter")
public class RuleBasedRouter {

    private final KieContainer kieContainer;

    public RuleBasedRouter() {
        KieServices ks = KieServices.Factory.get();
        this.kieContainer = ks.getKieClasspathContainer();
    }

    public void evaluate(Exchange exchange) {
        Map<String, Object> body = exchange.getIn().getBody(Map.class);
        Order order = new Order();
        order.setOrderId(((Number) body.get("order_id")).longValue());
        order.setAmount(((Number) body.get("amount")).doubleValue());
        order.setDestinationCountry((String) body.get("destination_country"));
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

// Camel route that uses the rule engine
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=rule-router")
    .routeId("drools-content-based-router")
    .unmarshal().json(Map.class)
    .bean("ruleBasedRouter", "evaluate")
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
    <artifactId>drools-engine</artifactId>
    <version>10.2.0</version>
</dependency>
<dependency>
    <groupId>org.drools</groupId>
    <artifactId>drools-xml-support</artifactId>
    <version>10.2.0</version>
</dependency>
<dependency>
    <groupId>org.drools</groupId>
    <artifactId>drools-mvel</artifactId>
    <version>10.2.0</version>
</dependency>
```

The `drools-engine` artifact provides the core KIE API without requiring the Drools Quarkus extension (which has version-coupling with the Quarkus build API). The `drools-xml-support` artifact provides `kmodule.xml` parsing, and `drools-mvel` provides the MVEL expression support used in DRL conditions.

---

*Verification status: <span class="status status--verified">verified</span> against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11). Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
