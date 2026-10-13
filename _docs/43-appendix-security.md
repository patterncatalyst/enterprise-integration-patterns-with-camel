---
title: "Appendix Y: Secure by Default"
order: 43
part: appendices
description: "What Camel 4.21 and 4.22 started doing for you — deserialization filters, header boundaries, dynamic URI allow-lists, path containment — and the three places you still have to decide."
duration: "20 minutes"
---

Every other appendix in this tutorial teaches you to build something. This one
is about something that changed underneath you.

Across Camel 4.21 and 4.22, the project's security posture moved from **safe if
you configure it** to **safe by default**. That is a single change of stance
expressed through about twenty individual fixes, and reading it as twenty fixes
is the wrong way round. The useful version is this: an integration framework is
a machine for moving untrusted bytes between systems that trust each other, and
Camel has stopped assuming you have thought about that.

The practical consequence for you is twofold. Most of this you now get for
free, which is worth knowing so you stop writing the workarounds. And a few
things you still have to decide, which is worth knowing because nothing will
prompt you.

## Why integration is the interesting attack surface

An EIP route is, structurally, a place where a message from somewhere else
determines what your process does next. That is the whole point of the patterns
in Part 5: a Content-Based Router branches on message content, a Dynamic Router
computes a destination from it, a Routing Slip lets the message carry its own
itinerary.

Every one of those is a decision made from data you did not author. Most of the
time the data is an order from your own front end. Occasionally it is whatever
a partner's misconfigured system sent, or whatever someone with an HTTP client
decided to try.

Three specific shapes recur, and Camel now defends all three by default:

1. **Deserialization** — turning bytes into objects is arbitrary code execution
   if the type is attacker-controlled.
2. **Boundary crossing** — a header set inside your system means something; the
   same header arriving from outside means something else entirely.
3. **Dynamic destinations** — a URI computed from a message is a request to
   talk to whatever the message says.

## What you now get without asking

**Deserialization is filtered.** Camel applies a JEP-290 `ObjectInputFilter` at
every deserialization site, with a default pattern that denies `java.net.**`,
allows the `java`, `javax` and `org.apache.camel` trees, and rejects everything
else — plus graph-shape limits (depth 20, 10,000 references, 10 MB) so a small
payload cannot expand into a large one. The Java serialization type converters
are gone from `camel-core` entirely, and JMS `ObjectMessage` is disabled unless
you turn it on. Jackson refuses unsafe polymorphic base types.

If you have ever written a custom `ObjectInputFilter` for a Camel application,
you can probably delete it.

**Headers stop at transport boundaries.** `DefaultHeaderFilterStrategy` now
lowercases by default and blocks `Camel`- and `camel`-prefixed headers in both
directions. More quietly, header constants across more than thirty components
were renamed to the `Camel*` convention *specifically so that this filter
catches them* — a fix that looks like churn in a changelog but is the whole
point.

This matters for [Chapter 8]({% link _docs/08-message-metadata.md %}). Headers
are how EIP carries metadata, and the boundary between "metadata my system set"
and "metadata that arrived from outside" is exactly where Correlation
Identifier and Return Address get interesting. Camel now assumes you did not
mean to let the outside world set `CamelRedelivered`.

**Paths are contained.** Remote-file and cloud-storage consumers reject paths
that escape their configured directory, and Zip Slip and Tar Slip are prevented
by stripping `CamelFileName` to its base name on archive entries.

**Credentials are masked harder.** URI sanitisation redacts `api-key` and
`authorization` parameters, and the default masking formatter covers userinfo
passwords in URIs and PEM private-key blocks. Your logs leak less than they did.

**The embedded HTTP server got stricter.** JWT handling is hardened, and the
`prod` profile now refuses to start on misconfigured authentication rather than
starting insecurely — which is the right failure, and will be an unwelcome
surprise exactly once.

## The three things you still have to decide

Defaults cannot make these calls for you.

### 1. Dynamic URIs need an allow-list

`toD`, `enrich` and the Dynamic Router all resolve a destination from an
expression. Camel 4.22 added `allowedSchemes`, but it is **off by default** —
because Camel cannot know which schemes your route legitimately needs.

```java
.toD().allowedSchemes("direct")
    .uri("direct:handle-${body[event_type]}");
```

Set it on every dynamic endpoint whose URI derives from message content. It
costs one line and closes the class of attack where a crafted value redirects
an exchange into `exec:`, `http:` or `file:`. [Chapter
14]({% link _docs/14-consumer-patterns.md %}) works through why the scheme
allow-list and a value check are two different layers and you generally want
both.

Related, and also off by default: the Dynamic Router will only accept a
`predicate` or `expressionLanguage` from a control message when
`allowPredicateFromMessage=true`. Leave it off. Letting a message supply an
expression is letting a message supply code.

### 2. Inbound authentication is yours to configure

The platform-http, servlet, jetty, netty-http and undertow consumers gained an
`oauthProfile` option for validating inbound bearer tokens, with an
`OAuthTokenValidationFactory` SPI behind it if you need custom validation. A
Camel route exposed over HTTP has no authentication until you give it some.

### 3. The header filter has a default, not an answer

Blocking `Camel*` headers at the boundary is a sensible default. It is not a
policy. If your integration deliberately propagates a correlation header across
a transport — which is a perfectly normal thing to do, and something
[Chapter 8]({% link _docs/08-message-metadata.md %}) shows — you need to say so
explicitly with a `HeaderFilterStrategy` that permits it. The default will
otherwise silently drop it, and "the correlation ID disappears when it crosses
JMS" is an annoying afternoon.

## What to do

If you are upgrading an existing application:

- Delete deserialization workarounds you wrote yourself; the framework does it now
- Check whether anything relied on `Camel*` headers surviving a transport hop
- Add `allowedSchemes` to every `toD` and `enrich` fed by message content
- Re-test HTTP endpoints under the `prod` profile before deploying, since
  misconfigured auth now fails startup

If you are writing something new, the defaults are
now good enough that the three decisions above are most of your remaining
security surface at the framework level — a meaningful change from two
releases ago.

---

*Verification status: <span class="status status--unverified">unverified</span> — a prose chapter with no runnable example, written from the [4.21](https://camel.apache.org/manual/camel-4x-upgrade-guide-4_21.html) and [4.22](https://camel.apache.org/manual/camel-4x-upgrade-guide-4_22.html) upgrade guides. The one item here that is exercised by code is `allowedSchemes`, in `examples/14-consumer-patterns/` on both runtimes. The rest describes framework behaviour this tutorial does not have a test for; treat the specifics as a map to the upgrade guides rather than as independently confirmed.*
