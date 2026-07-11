# Quarkus Flow — Appendix G Example

Demonstrates an order fulfillment saga (workflow orchestration) from Chapter 25 (Appendix G):

The saga orchestrates a multi-step order fulfillment process with compensation:

1. **Receive order** — start the saga, set state to RECEIVED
2. **Reserve inventory** — check availability, fail if high-value order unavailable
3. **Authorize payment** — check for fraud, compensate inventory if payment declined
4. **Ship order** — mark as shipped, saga complete

If any step fails, the saga runs compensating transactions (releasing inventory, etc.) before marking the order as failed.

## Running

```bash
# Start the infrastructure stack
cd ../../
./scripts/setup-stack.sh

# Run the example
cd examples/25-quarkus-flow
mvn quarkus:dev
```

## What to observe

- Orders flow through the saga states: RECEIVED → INVENTORY_RESERVED → PAYMENT_AUTHORIZED → SHIPPED
- High-value orders (amount > $500) fail at the inventory step
- Orders with IDs divisible by 7 fail at the payment step (simulated fraud), triggering inventory compensation
- Completed sagas publish to `eip.orders.saga-completed`; failed sagas to `eip.orders.saga-failed`
- The `OrderSagaManager` CDI bean tracks state transitions in a `ConcurrentHashMap`
