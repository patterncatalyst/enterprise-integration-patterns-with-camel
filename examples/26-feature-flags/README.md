# 26 — Feature Flags (Appendix H)

Three ways a feature flag changes what a Camel route does, evaluated at runtime
by [flagd](https://flagd.dev) through the vendor-neutral
[OpenFeature](https://openfeature.dev) SDK.

| Route | Flag | What it shows |
|---|---|---|
| `feature-flag-detour` | `enrichment-enabled` | A boolean flag switching a Detour on and off |
| `feature-flag-ab-test` | `new-routing-algorithm` | A 90/10 fractional split across two routing strategies |
| `feature-flag-targeted` | `hazmat-compliance-v2` | A targeted rollout — on for ENTERPRISE and VIP customers only |

Flag definitions live in `examples/_infra/flagd/flags.json`, mounted into the
flagd container. flagd watches the file, so **editing it takes effect on the
next message — no rebuild and no restart.** That is the point of the example;
try it.

## Running

flagd is part of the base stack:

```bash
./scripts/setup-stack.sh

cd examples/26-feature-flags/quarkus && mvn quarkus:dev
# or
cd examples/26-feature-flags/spring-boot && mvn spring-boot:run
```

A demo generator emits an order every five seconds, cycling customer tiers so
the targeted flag has something to discriminate on. Watch the log, then edit
`flags.json` — flip `enrichment-enabled` to `off`, or change the fractional
split to `[["legacy", 0], ["new", 100]]` — and watch the next message take a
different path.

## Things worth knowing

**The flagd version matters.** Pin it. The Java provider 0.14.2 cannot establish
its event stream against flagd v0.13.1: evaluation over the Connect RPC works
fine, but the provider never reaches ready, so every lookup silently falls back
to its default and the application looks like it is ignoring your flags. The
compose file pins **v0.16.3**, which works.

**Initialisation is non-blocking on purpose.** `FeatureFlagEvaluator` calls
`setProvider`, not `setProviderAndWait`. Every lookup supplies a default, so an
evaluation made before the stream is up returns the default rather than
failing. Blocking startup on flagd only converts a slow flag service into a
failed deployment — which is a bad trade for something whose job is to make
changes safer.

**The A/B split is stable, not random.** `targetingKey` is the order id, and
flagd hashes it, so a given order always lands on the same side of the split.
Sample size matters when you eyeball it: at 90/10 you need a few dozen messages
before the minority variant shows up at all.

**`toD` is constrained.** The A/B route resolves its destination from a flag
value — a string that comes from outside the application — so it sets
`allowedSchemes("direct")`. See Chapter 14 for why.

## Verified

2026-09-15, both runtimes, against flagd v0.16.3 in the compose stack:
the detour enriches while `enrichment-enabled` is on, ENTERPRISE and VIP orders
resolve `hazmat-compliance-v2` to `v2` while STANDARD gets `v1`, and the
fractional flag split 31 orders 29/2 between the legacy and new algorithms.
