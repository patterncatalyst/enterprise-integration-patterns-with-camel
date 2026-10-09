# 35 — Kafka Diagnostics (Appendix Q)

The checklist at the end of Appendix Q, run in order against the local stack.

```bash
./scripts/setup-stack.sh
cd examples/35-kafka-diagnostics

./kafka-diagnostics.sh                  # the whole workflow
./kafka-diagnostics.sh --group my-group # focus on one consumer group
./kafka-diagnostics.sh --dump <pid>     # thread dump and heap summary
```

## Why there is no Camel code here

None of this is route logic. It is what you do when a route has stopped moving
messages and you need to find out whether the problem is the consumer, the
broker, or the JVM — so the example is the diagnostic itself, not an
application to diagnose. Point it at any of the other examples while they run.

## What it checks

1. **Consumer group lag** — per group, with a warning over 1000. Lag climbing
   means too slow; lag large but flat usually means stopped.
2. **Consumer group state** — `Stable`, `Empty`, or stuck in a rebalance.
3. **Broker logs** — ERROR and WARN counts from the last 500 lines, plus
   rebalance mentions, with the last few errors printed.
4. **Topic health** — under-replicated and leaderless partitions. Both should
   always be zero on a single broker; anything else is the broker, not you.
5. **Camel route health** — probes the ports the examples use for `/q/health`
   and `/actuator/health`.
6. **JMX** — not exposed by default here; prints what to add to enable it.
7. **JVM** — finds Camel JVMs and offers `--dump`, which writes a thread dump
   and heap summary and reports any deadlocks.

## Two traps this script hit, both worth knowing

**`GROUPS` is a bash built-in array** holding the current user's group IDs.
Assign the Kafka group list to a variable of that name and `$GROUPS` still
expands to your own GID — so every step reports one nonexistent group named
after a number. The variable here is `GROUP_LIST` for exactly that reason.

**`kafka-consumer-groups.sh --state` does not put its header on line 1.** There
is a leading blank line, and `COORDINATOR (ID)` splits into two whitespace
fields. Parsing with `NR==1`, or counting back from `NF`, both give the wrong
column. The script locates the header by content instead.

A third, milder one: container processes are visible as host
processes, so a plain `pgrep -f quarkus-run.jar` also matches Apicurio inside
its container. Anything launched from `/deployments` is a container.

## Verified

2026-09-16, against the compose stack with `examples/09-routing-fundamentals`
running: six consumer groups reported with lag and `Stable` state, zero
under-replicated partitions, and `--dump` produced a 1072-line thread dump and
a heap summary with no deadlocks.
