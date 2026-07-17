# Appendix C: Pulsar Deep Dive

Demonstrates advanced Apache Pulsar patterns with Apache Camel, covering subscription types that control how messages are distributed across consumers, per-key ordering guarantees, and dead letter topic handling for messages that exhaust their redelivery attempts. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

- **Shared subscription** -- competing consumers where Pulsar distributes messages round-robin across multiple consumer instances attached to the same subscription
- **Key_Shared subscription** -- per-key ordering that ensures all messages with the same key (e.g., the same order ID) are always delivered to the same consumer instance
- **Dead letter topics** -- automatic routing of messages that fail after a configured number of redelivery attempts to a dead letter topic for manual review

## Running

```bash
# Start the infrastructure stack (Pulsar required)
./scripts/setup-stack.sh

# Quarkus
cd examples/21-pulsar-deep-dive/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/21-pulsar-deep-dive/spring-boot
mvn spring-boot:run
```

## Infrastructure

Requires **Pulsar** from the Podman stack. The Pulsar broker runs on `localhost:6650` with the admin interface on `localhost:8080`.

## Pulsar topics

| Topic | Description |
|-------|-------------|
| `persistent://public/default/eip.orders.placed` | Order events consumed with Shared subscription |
| `persistent://public/default/eip.orders.keyed` | Keyed order events consumed with Key_Shared subscription |
| `persistent://public/default/eip.orders.payments` | Payment orders with dead letter handling enabled |
| `persistent://public/default/eip.orders.payments-dlq` | Dead letter topic for failed payment orders |

## How to test

1. Start the application and watch the logs for messages flowing through all three route groups.
2. **Shared subscription** -- observe that the two consumer instances receive messages in a round-robin fashion from `eip.orders.placed`.
3. **Key_Shared subscription** -- observe that orders with the same key always land on the same consumer instance from `eip.orders.keyed`.
4. **Dead letter topics** -- single-item orders (quantity = 1) fail processing and are redelivered up to 3 times before landing in `eip.orders.payments-dlq`. The DLT monitor route logs each failed message.

Use the Pulsar admin CLI to inspect topics and subscriptions:

```bash
podman exec -it pulsar bin/pulsar-admin topics list public/default
podman exec -it pulsar bin/pulsar-admin topics subscriptions persistent://public/default/eip.orders.placed
```

---

*Verification status: unverified. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
