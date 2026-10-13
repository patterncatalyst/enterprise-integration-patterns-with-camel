---
title: "Appendix H: Feature Flags"
order: 26
part: appendices
description: "Flagd + OpenFeature with Camel routes — gradual rollouts, A/B testing, and runtime route control."
duration: "15 minutes"
---

The Detour pattern (Chapter 18) used configuration properties to toggle processing steps. Feature flags extend this to dynamic, fine-grained control: roll out a new enrichment step to 10% of traffic, enable hazmat routing only for specific customer tiers, or A/B test two content-based routing strategies.

The code is in `examples/26-feature-flags/`, with Quarkus and Spring Boot
variants and the flag definitions in `examples/_infra/flagd/flags.json`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/26-feature-flags/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/26-feature-flags/spring-boot
mvn spring-boot:run
```

flagd runs as part of the base stack, so `./scripts/setup-stack.sh` is all the
infrastructure you need. It watches the flag file, which means editing
`flags.json` changes behaviour on the next message — no rebuild, no
restart, no redeploy. Run the example and try it; that property is the whole
argument for feature flags and it is much more convincing seen than described.

## OpenFeature + flagd

**OpenFeature** is a vendor-neutral API for feature flag evaluation. **flagd** is a lightweight flag evaluation daemon that reads flag definitions from a file or ConfigMap.

### Architecture

{% include excalidraw.html file="26-feature-flags" alt="flagd architecture" caption="Figure Q.1 — flagd evaluation with OpenFeature SDK" %}

### Flag definitions

```json
{
  "flags": {
    "enrichment-enabled": {
      "state": "ENABLED",
      "variants": {
        "on": true,
        "off": false
      },
      "defaultVariant": "on",
      "targeting": {}
    },
    "new-routing-algorithm": {
      "state": "ENABLED",
      "variants": {
        "legacy": "content-based-router",
        "new": "dynamic-router"
      },
      "defaultVariant": "legacy",
      "targeting": {
        "fractional": [
          ["legacy", 90],
          ["new", 10]
        ]
      }
    },
    "hazmat-compliance-v2": {
      "state": "ENABLED",
      "variants": {
        "v1": false,
        "v2": true
      },
      "defaultVariant": "v1",
      "targeting": {
        "if": [
          { "in": ["$customer_tier", ["ENTERPRISE", "VIP"]] },
          "v2",
          "v1"
        ]
      }
    }
  }
}
```

### Integration with Camel

```java
@ApplicationScoped
@Named("featureFlags")
public class FeatureFlagEvaluator {

    @Inject
    Client openFeatureClient;

    public boolean isEnabled(String flagKey) {
        return openFeatureClient.getBooleanValue(flagKey, false);
    }

    public String getVariant(String flagKey, Map<String, Object> context) {
        MutableContext evalContext = new MutableContext();
        context.forEach((k, v) -> evalContext.add(k, String.valueOf(v)));
        return openFeatureClient.getStringValue(flagKey, "default", evalContext);
    }
}

// Detour controlled by feature flag
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=flag-router")
    .routeId("feature-flag-detour")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        boolean enrichmentEnabled = exchange.getContext()
            .getRegistry().lookupByNameAndType("featureFlags", FeatureFlagEvaluator.class)
            .isEnabled("enrichment-enabled");
        exchange.getIn().setHeader("enrichmentEnabled", enrichmentEnabled);
    })
    .choice()
        .when(header("enrichmentEnabled").isEqualTo(true))
            .to("direct:enrich-order")
        .otherwise()
            .log("Enrichment disabled by feature flag")
    .end()
    .to("direct:process-order");

// A/B test routing algorithm
from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=ab-test")
    .routeId("feature-flag-ab-test")
    .unmarshal().json(Map.class)
    .process(exchange -> {
        Map<String, Object> order = exchange.getIn().getBody(Map.class);
        FeatureFlagEvaluator flags = exchange.getContext()
            .getRegistry().lookupByNameAndType("featureFlags", FeatureFlagEvaluator.class);
        String algorithm = flags.getVariant("new-routing-algorithm",
            Map.of("customer_tier", String.valueOf(order.get("customer_tier"))));
        exchange.getIn().setHeader("routingAlgorithm", algorithm);
    })
    .toD("direct:${header.routingAlgorithm}");
```

## Running flagd in the compose stack

Add flagd to `compose.yaml`:

```yaml
flagd:
  image: ghcr.io/open-feature/flagd:v0.16.3
  container_name: eip-flagd
  ports:
    - "8013:8013"   # gRPC evaluation
    - "8014:8014"   # metrics / health
  volumes:
    - ./flagd/flags.json:/etc/flagd/flags.json:Z
  command: start --uri file:/etc/flagd/flags.json
  mem_limit: 256m
  networks:
    - eip-net
```

**Pin the version, and pin it above v0.16.** The Java provider 0.14.2 cannot
establish its event stream against flagd v0.13.1. The failure is quiet in the
worst way: evaluation over the Connect RPC still works if you curl it by hand,
but the provider never reaches ready, so the SDK returns the *default* for
every flag and your application looks like it is ignoring the flag file.
flagd is distroless, so it has no in-container healthcheck — `setup-stack.sh`
polls `http://localhost:8014/healthz` from the host instead.

## Dependencies

```xml
<dependency>
    <groupId>dev.openfeature</groupId>
    <artifactId>sdk</artifactId>
    <version>1.22.1</version>
</dependency>
<dependency>
    <groupId>dev.openfeature.contrib.providers</groupId>
    <artifactId>flagd</artifactId>
    <version>0.14.2</version>
</dependency>
```

On Quarkus you also need `camel-quarkus-bean`: the flag lookup is a bean-backed
expression, and Quarkus resolves the bean language only when that extension is
present. Without it the route fails at startup with `No language could be found
for: bean`, which does not point at the cause.

On Spring Boot, set `camel.main.run-controller=true`. Without a web starter
there is nothing else holding the JVM open, and the application shuts down a
few seconds after the routes start. Note the property name — `camel.main.`, not
`camel.springboot.`; the latter is silently ignored.

---

*Verification status: <span class="status status--verified">verified</span> — both runtime variants build against Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1) and their 10 Citrus integration tests pass against flagd v0.17.0 on Docker Engine, the fractional A/B split now asserted exactly (order ids 1–10 split 9 legacy / 1 new); both runtimes also run against the compose stack, the detour enriching while `enrichment-enabled` is on (2026-10-09).*
