# Appendix T: Deploying Camel to Kubernetes

Demonstrates the full Kubernetes deployment lifecycle for a Camel application: container image builds, manifest generation, deploying to Minikube, scaling with Kafka consumer groups, and externalized configuration. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

- **OrderApiRoute** — REST endpoint (`POST /api/orders`) that publishes incoming orders to a Kafka topic
- **OrderProcessorRoute** — Kafka consumer that enriches each order with customer data from Redis and publishes to an enriched orders topic
- **CacheLoaderRoute** — timer-based route that pre-populates Redis with sample customer records on startup

## Prerequisites

- Minikube v1.34+, kubectl v1.30+, Helm v3.16+
- Container runtime (Docker or Podman)
- Java 25+, Maven 3.9+

## Running

### Option 1: Local development (Podman stack)

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

### Option 2: Minikube deployment

```bash
# Set up Minikube with Strimzi Kafka + Redis
./scripts/setup-minikube-stack.sh

# Build and deploy (Quarkus)
eval $(minikube docker-env)
cd examples/38-kubernetes-deploy/quarkus
mvn package -DskipTests -Dquarkus.kubernetes.deploy=true

# Build and deploy (Spring Boot)
eval $(minikube docker-env)
cd examples/38-kubernetes-deploy/spring-boot
mvn spring-boot:build-image -DskipTests \
  -Dspring-boot.build-image.imageName=eip/eip-kubernetes-deploy-springboot:latest
kubectl apply -f k8s/
```

## Infrastructure

**Local development:** Requires Kafka and Redis from the Podman stack (`./scripts/setup-stack.sh`).

**Minikube deployment:** Uses Strimzi Kafka operator and Bitnami Redis Helm chart. The `k8s-infra/` directory contains the Strimzi Kafka cluster CR and topic definitions.

## Kafka topics

| Topic | Description |
|-------|-------------|
| `eip.orders.incoming` | Incoming orders from the REST API |
| `eip.orders.enriched` | Orders enriched with customer data from Redis |

## How to test

1. Port-forward the service: `kubectl port-forward svc/eip-k8s-deploy 8088:80`
2. Submit a test order:
   ```bash
   curl -X POST http://localhost:8088/api/orders \
     -H "Content-Type: application/json" \
     -d '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
   ```
3. Watch the logs: `kubectl logs -f deployment/eip-k8s-deploy`
4. Verify the enriched order includes `customerName: "Global Freight Ltd"` (looked up from Redis)
5. Scale to 3 replicas and observe Kafka consumer group rebalancing:
   ```bash
   kubectl scale deployment/eip-k8s-deploy --replicas=3
   ```

## Cleanup

```bash
./scripts/setup-minikube-stack.sh --clean
```

---

*Verification status: unverified. Quarkus variant compiles against Quarkus 3.37.0, Camel 4.20.0. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0.*
