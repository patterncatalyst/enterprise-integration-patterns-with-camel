# 36 — Kafka Connect Offsets (Appendix R)

The offset-management lifecycle from Appendix R, run against a real connector.

```bash
./scripts/setup-stack.sh

cd examples/36-kafka-connect-offsets
docker compose -p eip -f ../_infra/compose.yaml -f compose.connect.yaml up -d connect
./connect-offsets-demo.sh
```

Connect is a separate overlay rather than part of the base stack: it is only
needed for this appendix, and it is another JVM to keep warm.

## Why the REST API and not Strimzi

The chapter covers both. Strimzi's `KafkaConnector` CRD needs a Kubernetes
cluster, which for this repo means the minikube stack from Appendix T — a lot
of moving parts to demonstrate three HTTP calls. The REST API is the same
mechanism underneath and runs on the compose stack, so that is what the script
uses. The CRD annotations in the chapter map onto these endpoints one to one.

## What the script does

1. Creates a `FileStreamSourceConnector` reading 10 orders into a topic
2. `GET /connectors/{name}/offsets` — shows the byte position in the file
3. `PUT /connectors/{name}/stop` — offsets can only be changed while stopped
4. `PATCH /connectors/{name}/offsets` — rewinds the position to 0 (KIP-875)
5. `PUT .../resume` — the 10 orders are re-read and republished, so the topic
   goes from 10 records to 20. That jump is the proof the rewind took effect
6. `DELETE /connectors/{name}/offsets` — a full reset back to no offsets

## Four things that cost time here

**Kafka 4.x does not put the FileStream connectors on the worker classpath.**
They ship in `libs/` but are only discovered through `plugin.path`. Pointing
`plugin.path` at all of `libs/` works but makes the worker scan ~200 jars and
delays the REST port by minutes — so the compose file copies just the
`connect-file` jar into a directory of its own.

**Compose resolves relative volume paths against the first `-f` file's
directory**, not the file that declares the volume. A `./connect-data` mount
declared here lands in `examples/_infra/` when you pass the base compose first.
There is no bind mount now; the script writes the source file in with
`docker exec`.

**The image runs as a non-root user**, so the source file goes under `/tmp`.
Anything at the filesystem root fails to create.

**`kafka.tools.GetOffsetShell` moved to `org.apache.kafka.tools` in Kafka 4.x.**
The old `kafka-run-class.sh kafka.tools.GetOffsetShell` invocation that appears
in a lot of older documentation now fails with `ClassNotFoundException`. Use
`kafka-get-offsets.sh`.

## Verified

2026-09-16, against Kafka 4.3.1 and Connect 4.3.1 in the compose stack. The
connector read 10 records and reported byte position 328; after `PATCH` to
position 0 and a resume, the topic held 20 records; `DELETE` returned the
connector to no offsets.
