---
title: "Appendix G: Quarkus Flow"
order: 25
part: appendices
description: "Serverless workflows and saga orchestration with Quarkus Flow, integrated with Camel routes."
duration: "20 minutes"
---

The Process Manager pattern (Chapter 10) showed how Camel's Saga EIP handles multi-step workflows with compensation. Quarkus Flow provides a higher-level alternative: define workflows as state machines in JSON/YAML, with Quarkus managing state persistence, timeouts, and compensation.

The code is in `examples/25-quarkus-flow/`. The `README.md` there covers how to run it.

{% include excalidraw.html file="25-appendix-quarkus-flow" alt="Quarkus Flow order fulfillment workflow with state transitions and Camel integration" caption="Figure G.1 — The order fulfillment workflow as a Serverless Workflow state machine: operation states call CDI beans that invoke Camel routes for external system integration." %}

## What Quarkus Flow adds

| Feature | Camel Saga EIP | Quarkus Flow |
|---------|---------------|--------------|
| **Definition format** | Java/YAML DSL in routes | CNCF Serverless Workflow spec (JSON/YAML) |
| **State persistence** | Manual (JDBC repo) | Automatic (Kogito persistence) |
| **Visualization** | None built-in | Visual workflow editor |
| **Timeouts** | Manual implementation | Declarative in workflow definition |
| **Human tasks** | Not supported | Built-in task management |
| **Compensation** | `saga().compensate()` | Workflow-level error handling |

## Defining a workflow

The order fulfillment workflow as a Serverless Workflow definition:

```json
{
  "id": "order-fulfillment",
  "version": "1.0",
  "specVersion": "0.8",
  "name": "Order Fulfillment",
  "start": "ValidateOrder",
  "states": [
    {
      "name": "ValidateOrder",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "validateOrder",
            "arguments": {
              "orderId": ".order_id"
            }
          }
        }
      ],
      "transition": "CheckInventory"
    },
    {
      "name": "CheckInventory",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "checkInventory",
            "arguments": {
              "itemSku": ".item_sku",
              "quantity": ".quantity"
            }
          }
        }
      ],
      "transition": "InventoryDecision"
    },
    {
      "name": "InventoryDecision",
      "type": "switch",
      "dataConditions": [
        {
          "condition": ".available == true",
          "transition": "ProcessPayment"
        },
        {
          "condition": ".available == false",
          "transition": "BackorderNotification"
        }
      ],
      "defaultCondition": {
        "transition": "BackorderNotification"
      }
    },
    {
      "name": "ProcessPayment",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "processPayment",
            "arguments": {
              "orderId": ".order_id",
              "amount": ".amount"
            }
          }
        }
      ],
      "transition": "ScheduleShipping",
      "onErrors": [
        {
          "errorRef": "PaymentDeclined",
          "transition": "PaymentFailed"
        }
      ]
    },
    {
      "name": "ScheduleShipping",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "scheduleShipping"
          }
        }
      ],
      "end": true
    },
    {
      "name": "BackorderNotification",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "notifyBackorder"
          }
        }
      ],
      "end": true
    },
    {
      "name": "PaymentFailed",
      "type": "operation",
      "actions": [
        {
          "functionRef": {
            "refName": "notifyPaymentFailure"
          }
        }
      ],
      "end": true
    }
  ],
  "functions": [
    { "name": "validateOrder", "type": "custom", "operation": "service:orderValidator" },
    { "name": "checkInventory", "type": "custom", "operation": "service:inventoryChecker" },
    { "name": "processPayment", "type": "custom", "operation": "service:paymentProcessor" },
    { "name": "scheduleShipping", "type": "custom", "operation": "service:shippingScheduler" },
    { "name": "notifyBackorder", "type": "custom", "operation": "service:backorderNotifier" },
    { "name": "notifyPaymentFailure", "type": "custom", "operation": "service:paymentFailureNotifier" }
  ],
  "errors": [
    { "name": "PaymentDeclined", "code": "PAYMENT_DECLINED" }
  ]
}
```

## Connecting Quarkus Flow to Camel

The workflow functions call CDI beans — which can use Camel's `ProducerTemplate` to send messages:

```java
@ApplicationScoped
@Named("inventoryChecker")
public class InventoryChecker {

    @Inject
    FluentProducerTemplate producer;

    public Map<String, Object> checkInventory(String itemSku, int quantity) {
        Map<String, Object> request = Map.of(
            "item_sku", itemSku,
            "quantity", quantity);

        return producer.to("direct:check-inventory")
            .withBody(request)
            .request(Map.class);
    }
}
```

## When to use Quarkus Flow vs. Camel Saga

**Use Quarkus Flow when:**
- The workflow has many states with complex conditional transitions.
- You need visual workflow editing for business stakeholders.
- Human tasks are part of the workflow (approval steps).
- Long-running workflows that span hours or days (state persistence is critical).

**Use Camel Saga when:**
- The workflow is a simple linear sequence with compensation.
- The entire workflow completes in seconds.
- You want to keep everything in Camel routes without a separate framework.

## Dependencies

```xml
<dependency>
    <groupId>io.quarkus</groupId>
    <artifactId>quarkus-serverless-workflow</artifactId>
    <version>0.12.0</version>
</dependency>
```

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: Quarkus Flow / Kogito Serverless Workflow extension exists at version 0.12.0; CNCF Serverless Workflow spec version 0.8 is the correct spec; `quarkus-serverless-workflow` artifact ID is correct; workflow function `type: custom` with `operation: service:beanName` invokes CDI beans.*
