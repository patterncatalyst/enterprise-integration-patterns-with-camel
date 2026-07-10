# Bond Trading Case Study (Appendix K)

Market Data Distribution pattern implementation using Apache Camel on Quarkus.
Raw price feeds arrive from three market data sources (Bloomberg, Reuters, Exchange),
each with its own proprietary format. Channel Adapters normalize every feed into a
canonical price, an Aggregator selects the best composite bid/ask across sources,
and a Content-Based Router multicasts filtered prices to trading desk topics.
A separate trade validation pipeline deduplicates and validates incoming orders
before forwarding them for execution.

## Architecture

```
bond.feed.raw.bloomberg ──> [Adapter: Bloomberg] ──┐
bond.feed.raw.reuters   ──> [Adapter: Reuters]   ──┼──> bond.prices.canonical
bond.feed.raw.exchange  ──> [Adapter: Exchange]  ──┘
                                                         |
                                                         v
                                                   [Normalizer]
                                                 (aggregate by ISIN,
                                                  best bid / best ask)
                                                         |
                                                         v
                                                  bond.prices.best
                                                         |
                                                         v
                                                 [Desk Distributor]
                                              (multicast + filter)
                                             /         |         \
                                            v          v          v
                           bond.prices      bond.prices      bond.prices
                           .filtered        .filtered         .filtered
                           .desk-a          .desk-b           .desk-c
                          (government)     (corporate)       (all bonds)


bond.orders.new ──> [Trade Validator] ──> bond.orders.validated
                     (idempotent +            |
                      validation)             v
                          |             bond.audit.log
                          v              (wire tap)
                     rejected orders
                      (logged only)
```

## Kafka Topics

| Topic                          | Purpose                                           |
|--------------------------------|---------------------------------------------------|
| `bond.feed.raw.bloomberg`      | Raw price updates from Bloomberg adapter           |
| `bond.feed.raw.reuters`        | Raw price updates from Reuters adapter             |
| `bond.feed.raw.exchange`       | Raw price updates from Exchange adapter            |
| `bond.prices.canonical`        | Normalized canonical prices from all sources       |
| `bond.prices.best`             | Best composite bid/ask after aggregation           |
| `bond.prices.filtered.desk-a`  | Government bonds for Desk A                        |
| `bond.prices.filtered.desk-b`  | Corporate bonds for Desk B                         |
| `bond.prices.filtered.desk-c`  | All bonds for Desk C                               |
| `bond.orders.new`              | Incoming trade orders                              |
| `bond.orders.validated`        | Orders that passed validation                      |
| `bond.audit.log`               | Audit trail of all orders (wire tap)               |

## Running

Start Kafka (from the `_infra/` directory or via Docker):

```bash
docker compose up -d
```

Run the Quarkus application in dev mode:

```bash
./mvnw quarkus:dev
```

The demo timers generate market data every 2 seconds and trade orders every
10 seconds automatically. Watch the console logs to see prices flowing through
the Channel Adapters, Normalizer, and Desk Distributor pipeline.

## Verification Status

**Unverified** -- this example has not yet been compiled or run against a live Kafka broker.
