# 19 — Runtime Comparison (Appendix A)

One route, three ways to run it. The point of this example is the `diff`:

```bash
diff quarkus/src/main/java/com/example/eip/comparison/OrderClassifierRoute.java \
     spring-boot/src/main/java/com/example/eip/comparison/OrderClassifierRoute.java
```

Four lines: an import and an annotation. Everything else — the `from`, the
`choice`, the `simple` expressions, the `to` — is byte-identical. That is the
claim Appendix A makes, and this is where you can check it rather than take it
on trust.

## Running

```bash
./scripts/setup-stack.sh

cd quarkus      && mvn quarkus:dev
cd spring-boot  && mvn spring-boot:run
cd yaml-dsl     && camel run order-classifier.camel.yaml   # no Maven project at all
```

Send an order and watch any of them classify it:

```bash
echo '{"order_id":"DSL-1","amount":640.00,"item_sku":"W-1"}' \
  | docker exec -i eip-kafka /opt/kafka/bin/kafka-console-producer.sh \
      --bootstrap-server localhost:9092 --topic eip.orders.placed
```

## Where the runtimes actually differ

| | Quarkus | Spring Boot |
|---|---|---|
| Route discovery | `@ApplicationScoped` | `@Component` |
| App name | `quarkus.application.name` | `spring.application.name` |
| HTTP port | `quarkus.http.port` | `server.port` |
| Keeping the JVM alive | automatic | `camel.main.run-controller=true` |

Two traps, both of which cost time the first time:

**Quarkus needs `camel-quarkus-bean`** for `${body[amount]}` inside a `simple`
expression — map accessors resolve through the bean language, and Quarkus only
registers a language when its extension is present. Without it the route fails
at startup with `No language could be found for: bean`, which does not point at
the cause at all.

**The run-controller property is `camel.main.run-controller`**, not
`camel.springboot.main-run-controller`. The latter is accepted silently and
does nothing, and a Spring Boot app with no web starter then exits a few
seconds after its routes start.

## Verified

2026-09-15, all three runtimes against the compose stack. Each classifies
`amount > 500` as `HIGH_VALUE` and the rest as `STANDARD`, with identical log
output: Quarkus (DSL-3/DSL-4), Spring Boot (DSL-1/DSL-2), YAML DSL via
`camel run` (DSL-5/DSL-6). The YAML file also validates clean against the
Camel YAML DSL schema.
