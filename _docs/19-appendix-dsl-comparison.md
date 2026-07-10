---
title: "Appendix A: Camel DSL Comparison"
order: 19
part: appendices
description: "Java DSL vs YAML DSL vs XML DSL — when to use each, side-by-side comparison, and migration between them."
duration: "20 minutes"
---

Throughout this tutorial, every code example appears in three DSLs. This appendix explains when to choose each one, shows the structural differences side-by-side, and covers how to migrate between them.

## The three DSLs

Apache Camel 4.x supports multiple route definition languages. The three most widely used are:

| DSL | Format | Best for | IDE support |
|-----|--------|----------|-------------|
| **Java DSL** | Java fluent API | Full-featured applications, complex logic, type safety | Full (completion, refactoring, debugging) |
| **YAML DSL** | YAML files | JBang prototypes, GitOps, configuration-driven routing | Schema-based (VS Code YAML extension) |
| **XML DSL** | XML (`<routes>` or Spring XML) | Legacy projects, Spring Boot XML config, tooling that generates XML | Schema-based (XSD validation) |

### Java DSL

The Java DSL uses Camel's fluent builder API. Routes are defined in `RouteBuilder` subclasses (or with Camel Quarkus, in CDI beans annotated `@ApplicationScoped`):

```java
@ApplicationScoped
public class OrderRoutes extends RouteBuilder {
    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers=localhost:9092&groupId=inventory-service")
            .routeId("inventory-check")
            .unmarshal().json(Map.class)
            .filter(simple("${body[amount]} >= 50"))
                .to("direct:check-inventory")
            .end()
            .choice()
                .when(header("inStock").isEqualTo(true))
                    .to("kafka:eip.inventory.reserved?brokers=localhost:9092")
                .otherwise()
                    .to("kafka:eip.inventory.backorder?brokers=localhost:9092")
            .end();
    }
}
```

**Strengths:**
- Full IDE support — autocompletion, refactoring, inline documentation.
- Type-safe predicates and expressions.
- Inline Java logic in `process()` blocks — no need for separate beans.
- Debuggable — set breakpoints in route definitions and processors.
- Access to the full Camel API — every option and configuration is available.

**Weaknesses:**
- Requires compilation — changes need a rebuild (mitigated by Quarkus dev mode).
- Harder to manage as configuration — you can't update routes without deploying code.
- Verbose for simple routes.

### YAML DSL

The YAML DSL defines routes as YAML files. Camel loads them at startup (or reloads in dev mode):

```yaml
- route:
    id: inventory-check
    from:
      uri: "kafka:eip.orders.placed"
      parameters:
        brokers: "localhost:9092"
        groupId: "inventory-service"
    steps:
      - unmarshal:
          json: {}
      - filter:
          simple: "${body[amount]} >= 50"
          steps:
            - to:
                uri: "direct:check-inventory"
      - choice:
          when:
            - simple: "${header.inStock} == true"
              steps:
                - to:
                    uri: "kafka:eip.inventory.reserved"
                    parameters:
                      brokers: "localhost:9092"
          otherwise:
            steps:
              - to:
                  uri: "kafka:eip.inventory.backorder"
                  parameters:
                    brokers: "localhost:9092"
```

**Strengths:**
- No compilation — edit the YAML, Camel reloads (especially with `camel run --dev`).
- GitOps-friendly — routes are data, not code. Store in ConfigMaps, deploy via git.
- JBang-native — `camel run route.yaml` is the fastest way to prototype.
- Human-readable — non-developers can read and understand the flow.

**Weaknesses:**
- Limited IDE support — no autocompletion for Camel-specific constructs (though improving).
- Complex logic requires processor bean references — you can't write inline Java.
- YAML indentation sensitivity — a misplaced indent can change route structure silently.
- Not all Camel features have YAML equivalents (though coverage is near-complete in 4.20).

### XML DSL

The XML DSL uses Camel's `<routes>` element or Spring XML configuration:

```xml
<routes xmlns="http://camel.apache.org/schema/spring">
  <route id="inventory-check">
    <from uri="kafka:eip.orders.placed?brokers=localhost:9092&amp;groupId=inventory-service"/>
    <unmarshal><json/></unmarshal>
    <filter>
      <simple>${body[amount]} >= 50</simple>
      <to uri="direct:check-inventory"/>
    </filter>
    <choice>
      <when>
        <simple>${header.inStock} == true</simple>
        <to uri="kafka:eip.inventory.reserved?brokers=localhost:9092"/>
      </when>
      <otherwise>
        <to uri="kafka:eip.inventory.backorder?brokers=localhost:9092"/>
      </otherwise>
    </choice>
  </route>
</routes>
```

**Strengths:**
- XSD validation — IDEs validate the XML structure against Camel's schema.
- Tooling support — visual route editors (like Kaoto) generate and consume XML.
- Legacy compatibility — works with Spring XML, Blueprint (OSGi), and older Camel versions.
- Well-understood — XML is a known quantity in enterprise environments.

**Weaknesses:**
- Verbose — XML is naturally more verbose than Java or YAML.
- `&amp;` everywhere — URI parameters with `&` must be escaped.
- Falling out of favor — Camel community is moving toward YAML and Java DSL.

## When to choose each

| Scenario | Recommended DSL |
|----------|----------------|
| **Prototyping with JBang** | YAML |
| **Production Quarkus application** | Java DSL |
| **Routes managed by non-developers** | YAML |
| **GitOps / ConfigMap-driven deployment** | YAML |
| **Complex business logic in routes** | Java DSL |
| **Visual route editing (Kaoto)** | XML |
| **Migrating from legacy Spring/Blueprint** | XML → Java DSL (gradually) |
| **Mixed: some routes static, some dynamic** | Java DSL for static + YAML for dynamic |

### Our tutorial workflow

This tutorial uses the "prototype → promote" workflow:

1. **Prototype** in YAML with `camel run --dev` (fast iteration, no build).
2. **Inspect** with `camel get`, `camel trace`, `camel top`.
3. **Promote** to Java DSL in a Quarkus project with `camel export --runtime=quarkus`.
4. **Test** with the Camel test framework (`camel-quarkus-junit5`).
5. **Deploy** as a Quarkus native image in a container.

The YAML → Java translation is straightforward because the structure maps 1:1. `camel export` handles this automatically for simple routes.

## Structural mapping

Every construct maps across all three DSLs:

| Concept | Java DSL | YAML DSL | XML DSL |
|---------|----------|----------|---------|
| Route entry | `from("uri")` | `from: uri: "uri"` | `<from uri="uri"/>` |
| Send to endpoint | `.to("uri")` | `- to: uri: "uri"` | `<to uri="uri"/>` |
| Dynamic send | `.toD("uri")` | `- toD: uri: "uri"` | `<toD uri="uri"/>` |
| Set header | `.setHeader("name", constant("val"))` | `- setHeader: name: name` / `constant: "val"` | `<setHeader name="name"><constant>val</constant></setHeader>` |
| Choice | `.choice().when(pred).to(uri).otherwise().to(uri).end()` | `- choice: when: ... otherwise: ...` | `<choice><when>...<otherwise>...</choice>` |
| Filter | `.filter(pred).to(uri).end()` | `- filter: simple: "pred"` | `<filter><simple>pred</simple>...</filter>` |
| Split | `.split(expr).to(uri).end()` | `- split: jsonpath: "$..."` | `<split><jsonpath>$...</jsonpath>...</split>` |
| Aggregate | `.aggregate(corr, strat).completionSize(n)` | `- aggregate: correlationExpression: ...` | `<aggregate>...</aggregate>` |
| Bean call | `.bean("name", "method")` | `- bean: ref: "#name"` | `<bean ref="#name" method="method"/>` |
| Process | `.process(exchange -> {...})` | `- process: ref: "#beanName"` | `<process ref="#beanName"/>` |
| Error handler | `errorHandler(deadLetterChannel("uri"))` | Top-level `errorHandler:` | `<errorHandler><deadLetterChannel .../></errorHandler>` |
| Route ID | `.routeId("id")` | `id: "id"` | `id="id"` |

## Migration tips

**YAML → Java DSL** (`camel export`):
```bash
camel export --runtime=quarkus --directory=my-project route.yaml
```
This generates a Quarkus project with the route translated to Java DSL. Review and adjust — complex YAML constructs may need manual tuning.

**Java DSL → YAML**: Manual translation following the mapping table above. There's no automated tool, but the structure is mechanical.

**XML → Java DSL**: Most teams migrate incrementally. Camel Quarkus can load XML routes from the classpath alongside Java DSL routes — so you can migrate one route at a time.

---

*Verification status: <span class="status status--unverified">unverified</span>.
Confirm: `camel export --runtime=quarkus` generates a Quarkus project from YAML routes; YAML DSL syntax matches Camel 4.20 specification; XML DSL namespace is `http://camel.apache.org/schema/spring`.*
