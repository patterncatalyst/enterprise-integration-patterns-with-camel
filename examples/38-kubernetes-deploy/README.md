# Appendix T: Deploying Camel to Kubernetes

Demonstrates the full Kubernetes deployment lifecycle for a Camel application: container image builds, manifest generation, deploying to Minikube, scaling with Kafka consumer groups, and externalized configuration. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

- **OrderApiRoute** — REST endpoint (`POST /api/orders`) that publishes incoming orders to a Kafka topic
- **OrderProcessorRoute** — Kafka consumer that enriches each order with customer data from Redis and publishes to an enriched orders topic
- **CacheLoaderRoute** — timer-based route that pre-populates Redis with sample customer records on startup

## Prerequisites

- Docker Engine (`docker-ce`, docker context `default`) on Fedora or RHEL
- minikube v1.39+, kubectl v1.36, Helm v3.18+ (or v4), jq
- Java 25+, Maven 3.9+

## Running

### Option 1: Local development (compose stack)

```bash
# Start the local infrastructure stack (Kafka + Redis required)
./scripts/setup-stack.sh

# Quarkus
cd examples/38-kubernetes-deploy/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/38-kubernetes-deploy/spring-boot
mvn spring-boot:run
```

### Option 2: minikube

```bash
# Profile "eip": docker driver, containerd, Kubernetes v1.36.5, NodePort 30088
# published on 127.0.0.1; Strimzi 1.2.0 Kafka and Redis
./scripts/setup-minikube-stack.sh

# Build (mvn + docker build), minikube image load, deploy, and send one order
./examples/38-kubernetes-deploy/deploy-minikube.sh quarkus
./examples/38-kubernetes-deploy/deploy-minikube.sh spring-boot
```

Every command names its target (`minikube -p eip`, `kubectl --context eip`,
`helm --kube-context eip`). The API is reached through the published NodePort
at `http://127.0.0.1:30088` — no port-forward or tunnel.

### Option 3: OpenShift Local

The Quarkus variant also runs on OpenShift Local with an in-cluster S2I build
and an edge-TLS Route: see `openshift/` and Appendix Z.

## Infrastructure

**Local development:** Kafka and Redis from the compose stack (`./scripts/setup-stack.sh`).

**minikube:** the Strimzi Kafka operator (OCI Helm chart, `kafka.strimzi.io/v1`)
and a plain Redis Deployment. `k8s-infra/` holds the Kafka cluster and node
pool, the topics, and Redis.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.incoming` | Incoming orders from the REST API |
| `eip.orders.enriched` | Orders enriched with customer data from Redis |

## How to test

1. Submit a test order through the NodePort:
   ```bash
   curl -X POST http://127.0.0.1:30088/api/orders \
     -H "Content-Type: application/json" \
     -d '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
   ```
2. Watch the logs: `kubectl --context eip logs -f deployment/eip-k8s-deploy`
3. Verify the enriched order includes `customerName: "Global Freight Ltd"` (looked up from Redis)
4. Scale to 3 replicas and observe Kafka consumer group rebalancing:
   ```bash
   kubectl --context eip scale deployment/eip-k8s-deploy --replicas=3
   ```

## Cleanup

```bash
./scripts/setup-minikube-stack.sh --clean    # remove app, Kafka, Redis; stop the profile
./scripts/setup-minikube-stack.sh --delete   # delete the profile
```

---

*Verification status: unverified on a cluster. Both variants build against Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1); the minikube and OpenShift Local paths await a live run (2026-10-09).*
