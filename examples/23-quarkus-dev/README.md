# 23 — Quarkus Dev Mode (Appendix E)

The one example in this tutorial you are meant to **edit while it runs**.

```bash
cd examples/23-quarkus-dev/quarkus
mvn quarkus:dev
```

No `setup-stack.sh` first. Dev Services starts a Kafka broker for you.

## What to try

**1. Dev Services.** Watch the startup log:

```
Dev Services for Kafka started. ... -Dkafka.bootstrap.servers=localhost:42495
```

A broker on a random port, wired in automatically, torn down when you quit.

**2. Live reload.** Open `OrderPriorityRoute.java` and change
`PRIORITY_THRESHOLD` from `500.00` to `100.00`. Save. The generator sends an
order every five seconds — the next one is classified against the new
threshold. No restart, no rebuild.

**3. Continuous testing.** Press `r`. `OrderPriorityRouteTest` runs on every
save. Change the threshold again and watch it stay green — the test reads the
constant rather than hard-coding it. Now change one of the *expected* values in
the test and watch it go red within a second of saving.

**4. Dev UI.** [localhost:8097/q/dev](http://localhost:8097/q/dev) — the Camel
panel lists routes, and you can start and stop them without touching the code.

## The trap worth knowing

Dev Services **back off the moment you configure the connection yourself.** If
`application.properties` sets `kafka.bootstrap.servers` outside a profile,
Quarkus assumes you meant that broker and never starts a container — no
warning, no log line, nothing. It looks exactly like Dev Services being broken.

That is why this example scopes the property to `%prod` and `%test` and leaves
`%dev` alone. Every other example in the repo sets it unconditionally, because
they are all built to run against the compose stack.

## Verified

2026-09-15, re-verified 2026-09-17. `mvn quarkus:dev` starts Dev Services for
Kafka on a random port (observed: 42495) with no infrastructure running, the
routes classify orders against it (129.99 → STANDARD, 640.00 → EXPEDITED at a
500.00 threshold), `mvn test` passes 2 tests, **and the packaged application
boots**.

That last one matters. The original verification skipped it, and the packaged
app did not in fact start: the Simple map accessors in `.log()` resolve through
the bean language, which Quarkus registers only when `camel-quarkus-bean` is
present — and the Citrus test dependencies were quietly supplying `camel-bean`
on the *test* classpath. Dev mode ran, the tests passed, and the artefact you
would actually ship failed at startup. This is exactly what
`scripts/verify-all-runtime.sh` exists to catch. Testcontainers needs the Docker daemon reachable on the
default context — see [CONTRIBUTING.md](../../CONTRIBUTING.md#running-the-tests).
