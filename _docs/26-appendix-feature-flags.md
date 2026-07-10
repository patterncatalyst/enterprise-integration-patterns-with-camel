---
title: "Appendix H: Feature Flags"
order: 26
part: appendices
description: "Flagd + OpenFeature with Camel routes — gradual rollouts, A/B testing, and runtime route control."
duration: "15 minutes"
---

The Detour pattern (Chapter 18) used configuration properties to toggle processing steps. Feature flags extend this to dynamic, fine-grained control: roll out a new enrichment step to 10% of traffic, enable hazmat routing only for specific customer tiers, or A/B test two content-based routing strategies.

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

## Running flagd in the Podman stack

Add flagd to `compose.yaml`:

```yaml
flagd:
  image: ghcr.io/open-feature/flagd:latest
  ports:
    - "8013:8013"
  volumes:
    - ./flags.json:/etc/flagd/flags.json
  command: start --uri file:/etc/flagd/flags.json
  networks:
    - eip-net
```

## Dependencies

```xml
<dependency>
    <groupId>dev.openfeature</groupId>
    <artifactId>sdk</artifactId>
    <version>1.7.0</version>
</dependency>
<dependency>
    <groupId>dev.openfeature.contrib.providers</groupId>
    <artifactId>flagd</artifactId>
    <version>0.7.0</version>
</dependency>
```

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: OpenFeature SDK `dev.openfeature:sdk` artifact exists; flagd provider `dev.openfeature.contrib.providers:flagd` exists; flagd container image `ghcr.io/open-feature/flagd` is the correct registry; `MutableContext` class is in the OpenFeature SDK; flagd `--uri file:` flag syntax is correct.*
