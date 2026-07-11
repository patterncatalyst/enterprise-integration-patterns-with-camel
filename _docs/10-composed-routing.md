---
title: "Composed Routing"
order: 10
part: message-routing
description: "Routing Slip, Process Manager, and Scatter-Gather — multi-step routing patterns that compose the fundamentals into dynamic, adaptive workflows."
duration: "45 minutes"
---

> **Runnable example:** The code from this chapter is in [`examples/10-composed-routing/`](https://github.com/patterncatalyst/enterprise-integration-patterns-with-camel/tree/main/examples/10-composed-routing) — run it with `mvn quarkus:dev` against the local stack.

The previous chapter covered the building blocks: content-based router, filter, recipient list, and splitter. Each makes a single routing decision. But real workflows involve *sequences* of decisions: this order needs to go through fraud check, *then* inventory reservation, *then* payment — but the specific sequence depends on the order type, the customer tier, and the product category. The sequence isn't hardcoded; it's determined at runtime.

{% include excalidraw.html file="10-scatter-gather" alt="Scatter-Gather pattern" caption="Figure 10.1 — Scatter-Gather fans out to multiple recipients and aggregates their replies." %}

This chapter covers three patterns that compose routing steps into dynamic workflows.

## Pattern: Routing Slip

### The problem

When processing an order, different orders follow different processing sequences:

- **Standard domestic**: validate → check inventory → process payment → schedule shipping
- **International**: validate → customs declaration → check inventory → process payment → international logistics
- **Hazmat**: validate → hazmat compliance check → check inventory → process payment → hazmat shipping
- **VIP express**: validate → priority check inventory → express payment → expedited shipping → VIP notification

The sequence of processing steps varies per order. You could build a massive content-based router that handles every combination, but that becomes unwieldy — and every new order type requires code changes.

### The solution

A **Routing Slip** is a list of processing steps attached to the message itself. A router reads the slip and sends the message to each step in sequence. The sender determines the sequence at creation time — the router just follows the list.

Think of it like a doctor's referral chain: the primary care physician writes a referral to a specialist, who writes a referral to another specialist. Each step is determined by the previous step or by the initial assessment. The routing slip travels with the patient (message).

### How Camel models it

Camel's `routingSlip()` EIP reads a header containing a comma-separated list of endpoint URIs and routes the message through each one sequentially:

```java
// Step 1: Determine the routing slip based on order type
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=routing-slip")
    .routeId("routing-slip-entry")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        StringBuilder slip = new StringBuilder("direct:validate");

        String country = (String) order.get("destination_country");
        boolean hazmat = Boolean.TRUE.equals(order.get("contains_hazmat"));
        String priority = (String) order.get("shipping_priority");

        if (hazmat) {
            slip.append(",direct:hazmat-compliance");
        }
        if (!"US".equals(country)) {
            slip.append(",direct:customs-declaration");
        }
        if ("EXPRESS".equals(priority)) {
            slip.append(",direct:priority-inventory,direct:express-payment,direct:expedited-shipping");
        } else {
            slip.append(",direct:check-inventory,direct:process-payment,direct:schedule-shipping");
        }
        if ("VIP".equals(order.get("customer_tier"))) {
            slip.append(",direct:vip-notification");
        }
        exchange.getIn().setHeader("routingSlip", slip.toString());
    })
    .log("Routing slip for order ${body[order_id]}: ${header.routingSlip}")
    .routingSlip(header("routingSlip"));

// Each step processes the message and passes it through
from("direct:validate")
    .routeId("slip-step-validate")
    .log("Step: validating order ${body[order_id]}")
    .process(exchange -> {
        // Validation logic
        exchange.getIn().setHeader("validated", true);
    });

from("direct:hazmat-compliance")
    .routeId("slip-step-hazmat")
    .log("Step: hazmat compliance check for order ${body[order_id]}")
    .process(exchange -> {
        // Hazmat compliance logic
        exchange.getIn().setHeader("hazmatCleared", true);
    });

from("direct:customs-declaration")
    .routeId("slip-step-customs")
    .log("Step: customs declaration for order ${body[order_id]} to ${body[destination_country]}")
    .process(exchange -> {
        // Generate customs forms
        exchange.getIn().setHeader("customsDeclared", true);
    });
```

### Routing slip vs. content-based router

| Dimension | Routing Slip | Content-Based Router |
|-----------|-------------|---------------------|
| **Number of steps** | Multiple, in sequence | One destination |
| **Who decides** | The slip (attached to the message) | The predicates (in the route) |
| **Dynamic** | Fully — different messages have different slips | Semi — predicates are defined in code |
| **Maintainability** | New steps don't change existing code | New branches require code changes |

Use a routing slip when the message needs to visit multiple steps in a dynamic order. Use a content-based router when the message goes to one of N fixed destinations.

### Routing slip and the annotation-based approach

Camel also supports annotation-based routing slips in CDI/Quarkus beans:

```java
@RoutingSlip
public String determineSlip(@Header("orderType") String orderType,
                            @Header("destinationCountry") String country) {
    List<String> steps = new ArrayList<>(List.of("direct:validate"));
    if (!"US".equals(country)) {
        steps.add("direct:customs-declaration");
    }
    steps.add("direct:check-inventory");
    steps.add("direct:process-payment");
    return String.join(",", steps);
}
```

This lets you compute the slip in a plain Java method, which is easier to unit-test than an inline processor.

## Pattern: Process Manager

### The problem

The routing slip pattern works when the processing sequence is known *at the start*. But what about workflows where the *next step depends on the result of the current step*?

Consider the payment flow:
1. Authorize the card → if declined, try a different payment method.
2. If the backup payment method is a bank transfer, wait for async confirmation (could take hours).
3. Once payment is confirmed, proceed to fulfillment — but if the amount is above $10,000, add a manual fraud review step.
4. If the fraud review flags the order, cancel it; otherwise, proceed.

The sequence isn't predetermined — it's a state machine where each transition depends on the outcome of the previous step.

### The solution

A **Process Manager** (also called a Saga or Orchestrator) maintains the state of a multi-step process and makes routing decisions at each step based on the current state and the result of the previous step. Unlike a routing slip (which is a flat list), a process manager is a full state machine with conditional transitions.

### How Camel models it

Camel supports the Process Manager pattern through several mechanisms:

1. **The Saga EIP** — For long-running transactions with compensation (rollback) logic.
2. **State machines with exchange properties** — Manual state tracking through headers/properties and choice-based transitions.
3. **Dynamic Router** — A router that's called repeatedly, making the routing decision fresh each time (covered in Chapter 11).

Here's the payment flow as a Saga with compensation:

```java
from("kafka:eip.orders.payment-required?brokers=localhost:9092&groupId=payment-manager")
    .routeId("process-manager")
    .unmarshal().json(Map.class)
    .saga()
        .propagation(SagaPropagation.REQUIRES_NEW)
        .completionMode(SagaCompletionMode.MANUAL)
        .compensation("direct:payment-compensate")
        .completion("direct:payment-complete")
        .option("orderId", simple("${body[order_id]}"))
        .option("amount", simple("${body[amount]}"))
    // Step 1: Authorize primary payment
    .to("direct:authorize-payment")
    .choice()
        .when(header("paymentAuthorized").isEqualTo(true))
            .log("Payment authorized for order ${body[order_id]}")
            // Step 2: Fraud check if high value
            .choice()
                .when(simple("${body[amount]} >= 10000"))
                    .log("High-value order — routing to fraud review")
                    .to("direct:fraud-review")
                    .choice()
                        .when(header("fraudCleared").isEqualTo(true))
                            .to("direct:capture-payment")
                        .otherwise()
                            .log("Fraud review failed — canceling order")
                            .saga().compensate()
                    .end()
                .otherwise()
                    .to("direct:capture-payment")
            .end()
        .otherwise()
            .log("Payment declined — trying backup method")
            .to("direct:backup-payment")
            .choice()
                .when(header("backupAuthorized").isEqualTo(true))
                    .to("direct:capture-payment")
                .otherwise()
                    .log("All payment methods exhausted — canceling order")
                    .saga().compensate()
            .end()
    .end();

// Compensation: undo the payment
from("direct:payment-compensate")
    .routeId("payment-compensate")
    .log("COMPENSATING: refunding payment for order ${header.orderId}")
    .to("direct:refund-payment")
    .marshal().json()
    .to("kafka:eip.payments.refunded?brokers=localhost:9092");

// Completion: confirm the payment
from("direct:payment-complete")
    .routeId("payment-complete")
    .log("COMPLETED: payment confirmed for order ${header.orderId}")
    .marshal().json()
    .to("kafka:eip.payments.processed?brokers=localhost:9092");
```

### Saga vs. routing slip

| Dimension | Saga (Process Manager) | Routing Slip |
|-----------|----------------------|--------------|
| **Flow** | Conditional, branching | Linear, sequential |
| **Compensation** | Built-in rollback at each step | No rollback support |
| **State** | Managed by the saga coordinator | Stateless (message carries the slip) |
| **Use case** | Long-running transactions, workflows with error recovery | Fixed multi-step processing |

The saga pattern is essential for distributed transactions where partial completion requires compensating actions. The payment flow above is a textbook example: if fraud review fails after payment is authorized, the authorization must be reversed.

## Pattern: Scatter-Gather

### The problem

When a customer requests a shipping estimate, the shipping-service needs quotes from multiple carriers: FedEx, UPS, DHL, USPS. It sends the request to all carriers simultaneously (scatter), waits for responses (gather), and returns the best price to the customer.

This is different from a recipient list because the sender needs the *results back* — it's not fire-and-forget. And it's different from sequential processing because calling carriers one at a time would be too slow.

### The solution

A **Scatter-Gather** sends the same request to multiple recipients (scatter) and aggregates the responses into a single result (gather). It combines a recipient list (or multicast) with an aggregator.

### How Camel models it

Camel's `multicast()` with an `aggregationStrategy` is the natural implementation:

```java
from("direct:get-shipping-estimates")
    .routeId("scatter-gather")
    .log("Requesting shipping estimates for order ${body[order_id]}")
    .multicast(new LowestPriceAggregation())
        .parallelProcessing()
        .timeout(10000)
        .to("direct:quote-fedex", "direct:quote-ups", "direct:quote-dhl", "direct:quote-usps")
    .end()
    .log("Best shipping estimate: ${body[carrier]} at $${body[price]}");

// Each carrier endpoint
from("direct:quote-fedex")
    .routeId("carrier-fedex")
    .setHeader("carrier", constant("FedEx"))
    .to("http://fedex-api.example.com/rate?connectTimeout=5000")
    .unmarshal().json(Map.class)
    .log("FedEx quote: $${body[price]}");

from("direct:quote-ups")
    .routeId("carrier-ups")
    .setHeader("carrier", constant("UPS"))
    .to("http://ups-api.example.com/rate?connectTimeout=5000")
    .unmarshal().json(Map.class)
    .log("UPS quote: $${body[price]}");

from("direct:quote-dhl")
    .routeId("carrier-dhl")
    .setHeader("carrier", constant("DHL"))
    .to("http://dhl-api.example.com/rate?connectTimeout=5000")
    .unmarshal().json(Map.class)
    .log("DHL quote: $${body[price]}");

from("direct:quote-usps")
    .routeId("carrier-usps")
    .setHeader("carrier", constant("USPS"))
    .to("http://usps-api.example.com/rate?connectTimeout=5000")
    .unmarshal().json(Map.class)
    .log("USPS quote: $${body[price]}");
```

### The aggregation strategy

The aggregation strategy determines how individual responses are combined into a single result. For the shipping estimate, we want the lowest price:

```java
public class LowestPriceAggregation implements AggregationStrategy {
    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        if (oldExchange == null) {
            return newExchange;
        }
        Map<String, Object> oldBody = oldExchange.getIn().getBody(Map.class);
        Map<String, Object> newBody = newExchange.getIn().getBody(Map.class);

        double oldPrice = ((Number) oldBody.get("price")).doubleValue();
        double newPrice = ((Number) newBody.get("price")).doubleValue();

        return newPrice < oldPrice ? newExchange : oldExchange;
    }
}
```

Other common aggregation strategies:
- **Collect all** — Return a list of all responses (`AggregationStrategies.groupedExchange()`).
- **Best of N** — Compare by a metric and keep the best.
- **Merge** — Combine fields from all responses into a single response.
- **Majority vote** — If multiple services evaluate a condition, take the majority result.

### Handling partial results

The `timeout(10000)` ensures the scatter-gather doesn't wait forever if a carrier is slow. If DHL doesn't respond within 10 seconds, the aggregation proceeds with the 3 responses it has. This is critical for user-facing flows — a customer waiting for a shipping estimate can't wait 60 seconds for a slow carrier.

You can also set `stopOnException(false)` to continue aggregation even if one carrier throws an error (the failed carrier is excluded from the comparison).

## Common pitfalls

**Routing slips with side effects.** Each step in a routing slip should be idempotent or guard against re-execution. If the router retries (due to a Kafka rebalance), the entire slip re-executes. Steps that charge credit cards or send emails need idempotency protection.

**Process managers without persistent state.** If the process manager crashes mid-saga, the saga state is lost. For production sagas, use a persistent saga coordinator (LRA — Long Running Action) or store saga state in the database. Camel's in-memory saga works for testing but not for production.

**Scatter-gather without timeouts.** If one recipient hangs, the entire scatter-gather blocks. Always set a timeout. And always handle the case where fewer than N responses arrive — the aggregation strategy should work with partial results.

**Over-engineering with sagas.** Not every multi-step workflow needs a saga. If the steps are independent and failures don't require compensation, a simple routing slip or sequential pipeline is simpler and sufficient. Reserve sagas for workflows where partial completion requires explicit rollback.

## References

- Hohpe & Woolf, *Enterprise Integration Patterns*, Chapter 7: "Message Routing"
- [enterpriseintegrationpatterns.com — Routing Slip](https://www.enterpriseintegrationpatterns.com/patterns/messaging/RoutingTable.html)
- [enterpriseintegrationpatterns.com — Process Manager](https://www.enterpriseintegrationpatterns.com/patterns/messaging/ProcessManager.html)
- [enterpriseintegrationpatterns.com — Scatter-Gather](https://www.enterpriseintegrationpatterns.com/patterns/messaging/BroadcastAggregate.html)
- [Apache Camel — Routing Slip EIP](https://camel.apache.org/components/4.20.x/eips/routingSlip-eip.html)
- [Apache Camel — Saga EIP](https://camel.apache.org/components/4.20.x/eips/saga-eip.html)
- [Apache Camel — Multicast EIP](https://camel.apache.org/components/4.20.x/eips/multicast-eip.html)

## What you learned

- **Routing Slip** attaches a sequence of processing steps to the message — each step is visited in order, and different messages can have different slips.
- **Process Manager (Saga)** handles conditional, branching workflows with compensation — essential for distributed transactions where partial completion requires rollback.
- **Scatter-Gather** sends to multiple recipients in parallel and aggregates the responses — ideal for competitive quoting, consensus, and best-of-N selection.
- These patterns compose the fundamentals from Chapter 09 into dynamic, adaptive workflows that handle the complexity of real integration scenarios.

Next: Advanced Routing — Dynamic Router, Wire Tap, Resequencer, Composed Message Processor, and Load Balancer.

---

*Verification status: verified against Quarkus 3.37.0, Camel 4.20.0 on Podman (2026-07-11).*
