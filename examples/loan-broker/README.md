# Loan Broker Case Study (Appendix J)

Scatter-Gather pattern implementation using Apache Camel on Quarkus. A loan request
enters via REST or a timer-generated demo, is enriched with credit bureau data,
fanned out to eligible banks via a Recipient List, and the best offer is selected
by an Aggregator that picks the lowest approved interest rate.

## Architecture

```
POST /api/loans
       |
       v
  [Gateway] --> kafka:loan.requests
                     |
                     v
              [Credit Enricher] --> kafka:loan.enriched
                                         |
                                         v
                                  [Recipient List]
                                   /     |     \
                          bank-a  bank-b  bank-c
                                   \     |     /
                                    v    v    v
                              kafka:loan.bank.reply
                                         |
                                         v
                             [Aggregator: Best Offer]
                                         |
                                         v
                              kafka:loan.results
```

## Kafka Topics

| Topic              | Purpose                                     |
|--------------------|---------------------------------------------|
| `loan.requests`    | Incoming loan requests                      |
| `loan.enriched`    | Requests enriched with credit bureau data   |
| `loan.bank.reply`  | Individual bank quote responses             |
| `loan.results`     | Best-offer result after aggregation         |

## Running

Start Kafka (from the `_infra/` directory or via Docker):

```bash
docker compose up -d
```

Run the Quarkus application in dev mode:

```bash
./mvnw quarkus:dev
```

Submit a loan request manually:

```bash
curl -X POST http://localhost:8080/api/loans \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST-042",
    "amount": 250000,
    "termMonths": 360,
    "creditScore": 740
  }'
```

The demo timer also generates a request every 8 seconds automatically.

## Verification Status

**Unverified** -- this example has not yet been compiled or run against a live Kafka broker.
