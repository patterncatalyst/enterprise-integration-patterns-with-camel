---
title: "Appendix R: Managing Kafka Connect Offsets"
order: 36
part: appendices
description: "Listing, altering, and resetting connector offsets via the Kafka Connect REST API for reprocessing, migration, and recovery."
duration: "20 minutes"
---

Kafka Connect tracks its position in source and sink data streams using **connector offsets** — metadata stored in an internal Kafka topic (`connect-offsets` by default) that tells each connector where it left off. When a connector restarts, it resumes from its last committed offset. Managing these offsets — listing, resetting, and altering them — is essential for reprocessing data, recovering from failures, and migrating connectors between clusters.

## How connector offsets differ from consumer offsets

Consumer group offsets (Appendix B) track a consumer's position within a Kafka topic partition: `(group, topic, partition) → offset`. Connector offsets are more varied because connectors interface with external systems, not just Kafka topics.

### Source connector offsets

A source connector reads from an external system and writes to Kafka. Its offsets track the position in the source system:

| Source system | Offset format |
|---------------|---------------|
| Database (Debezium) | `{"server": "orders-db", "schema": "orders", "table": "orders"} → {"lsn": 123456, "txId": 789}` |
| File system | `{"filename": "/data/orders.csv"} → {"position": 4096}` |
| HTTP API | `{"endpoint": "/api/orders"} → {"last_id": 42, "timestamp": "2026-07-10T14:30:00Z"}` |

Each source connector defines its own offset format. The offset key identifies the source partition (table, file, API endpoint), and the offset value tracks the read position within that partition.

### Sink connector offsets

A sink connector reads from Kafka topics and writes to an external system. Its offsets are standard Kafka consumer offsets — identical to what `kafka-consumer-groups.sh` shows:

```json
{"topic": "eip.orders.placed", "partition": 0} → {"offset": 1042}
```

Sink connectors use a consumer group internally, so their offsets behave the same as any Kafka consumer.

## Listing connector offsets

The Kafka Connect REST API provides endpoints for inspecting connector offsets.

### List all connectors

```bash
curl -s http://localhost:8083/connectors | python3 -m json.tool
```

### Get offsets for a connector

```bash
curl -s http://localhost:8083/connectors/orders-source/offsets | python3 -m json.tool
```

Example response for a JDBC source connector:

```json
{
  "offsets": [
    {
      "partition": {
        "protocol": "1",
        "table": "orders.orders"
      },
      "offset": {
        "incrementing": 1042,
        "timestamp": 1720627800000,
        "timestamp_nanos": 0
      }
    }
  ]
}
```

This tells you the connector has read up to row 1042 in the `orders.orders` table. If you need to reprocess from row 500, you alter this offset.

## Altering connector offsets

The `PATCH /connectors/{name}/offsets` endpoint (introduced in Kafka Connect 3.6 / KIP-875) lets you modify offsets for a stopped connector.

### Step 1: Stop the connector

```bash
curl -X PUT http://localhost:8083/connectors/orders-source/stop
```

The connector must be stopped before offsets can be altered. This prevents race conditions between the running connector and the offset modification.

### Step 2: Alter the offset

```bash
curl -X PATCH http://localhost:8083/connectors/orders-source/offsets \
  -H "Content-Type: application/json" \
  -d '{
    "offsets": [
      {
        "partition": {
          "protocol": "1",
          "table": "orders.orders"
        },
        "offset": {
          "incrementing": 500,
          "timestamp": 1720540000000,
          "timestamp_nanos": 0
        }
      }
    ]
  }'
```

### Step 3: Resume the connector

```bash
curl -X PUT http://localhost:8083/connectors/orders-source/resume
```

The connector resumes from offset 500, reprocessing rows 501–1042 and continuing with new rows.

## Resetting connector offsets

To reset a connector's offsets entirely (start from scratch):

```bash
# Stop the connector
curl -X PUT http://localhost:8083/connectors/orders-source/stop

# Delete all offsets
curl -X DELETE http://localhost:8083/connectors/orders-source/offsets

# Resume — connector starts from the beginning
curl -X PUT http://localhost:8083/connectors/orders-source/resume
```

For sink connectors, deleting offsets means the consumer group restarts from whatever `auto.offset.reset` is configured (typically `earliest` or `latest`).

## Use cases for offset management

### Reprocessing after a bug fix

You deployed a sink connector that wrote orders to the wrong database table. After fixing the connector configuration:

1. Stop the connector
2. Fix the configuration: `curl -X PUT http://localhost:8083/connectors/orders-sink/config -d '...'`
3. Reset offsets to reprocess from a specific point
4. Resume

```bash
# Reset sink connector to reprocess from offset 0 on all partitions
curl -X PATCH http://localhost:8083/connectors/orders-sink/offsets \
  -H "Content-Type: application/json" \
  -d '{
    "offsets": [
      {"partition": {"topic": "eip.orders.placed", "partition": 0}, "offset": {"offset": 0}},
      {"partition": {"topic": "eip.orders.placed", "partition": 1}, "offset": {"offset": 0}},
      {"partition": {"topic": "eip.orders.placed", "partition": 2}, "offset": {"offset": 0}}
    ]
  }'
```

### Skipping bad records

A source connector is stuck on a corrupted row in the database. Advance past it:

```bash
# Advance past the problematic row
curl -X PATCH http://localhost:8083/connectors/orders-source/offsets \
  -H "Content-Type: application/json" \
  -d '{
    "offsets": [
      {
        "partition": {"protocol": "1", "table": "orders.orders"},
        "offset": {"incrementing": 1043}
      }
    ]
  }'
```

### Migrating a connector to a new cluster

When moving a connector from one Kafka Connect cluster to another:

1. Get the current offsets from the old cluster: `GET /connectors/{name}/offsets`
2. Create the connector on the new cluster with the same configuration
3. Stop the new connector
4. Set the offsets from step 1: `PATCH /connectors/{name}/offsets`
5. Resume the new connector

The connector picks up exactly where the old one left off, with no data loss or duplication.

## Offset storage internals

### The connect-offsets topic

Kafka Connect stores offsets in an internal compacted topic. The default topic name is `connect-offsets`, configurable via `offset.storage.topic` in the worker properties.

```bash
# Inspect the offset storage topic
podman exec eip-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic connect-offsets \
  --from-beginning \
  --property print.key=true
```

Each record in this topic is a key-value pair where the key identifies the connector and partition, and the value contains the offset. Because the topic uses log compaction, only the latest offset for each key is retained.

### Standalone vs. distributed mode

| Mode | Offset storage | Management |
|------|---------------|------------|
| **Standalone** | Local file (`offset.storage.file.filename`) | Manual file editing |
| **Distributed** | Kafka topic (`offset.storage.topic`) | REST API (preferred) |

The REST API offset management endpoints only work in distributed mode. In standalone mode, you'd need to edit the offset file directly — another reason to prefer distributed mode for anything beyond local development.

## Camel and Kafka Connect

While this tutorial focuses on Camel routes for integration logic, Kafka Connect is valuable for the data pipeline layer — moving data between databases, file systems, and Kafka topics with minimal code. The two complement each other:

| Responsibility | Tool |
|---------------|------|
| Data ingestion (DB → Kafka, file → Kafka) | Kafka Connect source connectors |
| Data egress (Kafka → DB, Kafka → file) | Kafka Connect sink connectors |
| EIP logic (routing, transformation, aggregation) | Camel routes |

A typical shipping domain pipeline combines all three:

{% include excalidraw.html file="36-connect-pipeline" alt="Data pipeline showing PostgreSQL flowing through Debezium source connector, Kafka, Camel route processing, and JDBC sink connector to analytics database" caption="Figure R.1 — A shipping domain pipeline: Debezium captures CDC events from PostgreSQL, Camel routes apply EIP logic (validate, enrich, route), and a JDBC sink connector writes processed orders to the analytics database. Each component manages its own offsets." %}

When the Camel route has a bug and you need to reprocess, you reset the Camel consumer group offsets (Appendix N). When the source connector misses rows, you alter the connector offset. When the sink connector writes to the wrong table, you fix the config and reset its offset. Each component has its own offset management surface.

---

*Verification status: <span class="status status--verified">verified</span> — conceptual reference chapter, no runnable example.*
