---
title: "Appendix T: Deploying Camel to Kubernetes"
order: 38
part: appendices
description: "Standard Maven-based container builds and Kubernetes deployments for Camel applications — Quarkus and Spring Boot on Minikube with Strimzi Kafka and Redis."
duration: "45 minutes"
---

Every chapter in this tutorial runs against a local Podman stack. But production Camel applications run on Kubernetes. This appendix covers the full deployment lifecycle — building container images, generating manifests, deploying to a real cluster, scaling, and externalizing configuration — using standard Maven tooling. No custom operators required.

The code is in `examples/38-kubernetes-deploy/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus
cd examples/38-kubernetes-deploy/quarkus
mvn quarkus:dev
```

```bash
# Spring Boot
cd examples/38-kubernetes-deploy/spring-boot
mvn spring-boot:run
```

{% include excalidraw.html file="38-kubernetes-deploy" alt="Minikube cluster with Camel application pods, Strimzi Kafka, and Redis" caption="Figure T.1 — Kubernetes deployment architecture: the Camel application consumes orders from Kafka, enriches via Redis, and publishes to an enriched orders topic." %}

## Why standard builds

Operator-based approaches like Camel K abstract away the build-and-deploy cycle. That convenience comes at a cost: the operator must be installed and maintained, your CI/CD pipeline can't use standard Maven phases, and debugging requires understanding both the operator's reconciliation loop and the underlying Kubernetes resources.

Standard builds give you:

| Advantage | Detail |
|-----------|--------|
| **Portability** | The same image and manifests work on Minikube, EKS, GKE, AKS, and OpenShift |
| **CI/CD integration** | `mvn package` in any pipeline; no custom CLI or operator dependency |
| **Team familiarity** | Dockerfiles, Deployments, and ConfigMaps are universal Kubernetes knowledge |
| **Debugging** | `kubectl logs`, `kubectl describe pod` — nothing between your code and the cluster |

## Prerequisites

Before starting, verify:

```bash
minikube version    # v1.34+
kubectl version     # v1.30+
helm version        # v3.16+
java -version       # 25+
mvn -version        # 3.9+
```

You also need a container runtime — either Docker or Podman.

## Minikube setup

Start a Minikube cluster with enough resources for Kafka, Redis, and the Camel application:

```bash
# Start Minikube (auto-detects podman or docker)
minikube start --cpus=4 --memory=8192

# Enable useful addons
minikube addons enable registry
minikube addons enable metrics-server
```

Configure your shell to build images directly inside Minikube's container runtime — this avoids the need to push images to a registry:

```bash
eval $(minikube docker-env)
```

The automated setup script does all of this plus infrastructure deployment:

```bash
./scripts/setup-minikube-stack.sh
```

## Deploying infrastructure

The example needs Kafka and Redis running inside the cluster.

### Strimzi Kafka

[Strimzi](https://strimzi.io) deploys and manages Kafka on Kubernetes via custom resources. Install the operator with Helm, then apply a Kafka cluster CR:

```bash
# Install the Strimzi operator
helm repo add strimzi https://strimzi.io/charts/
helm install strimzi strimzi/strimzi-kafka-operator \
  -n kafka --create-namespace --wait --timeout 300s
```

Apply the Kafka cluster CR from `examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml`:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: eip-kafka
  namespace: kafka
spec:
  kafka:
    version: 3.9.0
    replicas: 1
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
    config:
      offsets.topic.replication.factor: 1
      transaction.state.log.replication.factor: 1
      transaction.state.log.min.isr: 1
      default.replication.factor: 1
      min.insync.replicas: 1
    storage:
      type: ephemeral
    resources:
      requests:
        memory: 1Gi
        cpu: 500m
      limits:
        memory: 2Gi
        cpu: "1"
  zookeeper:
    replicas: 1
    storage:
      type: ephemeral
  entityOperator:
    topicOperator: {}
```

This defines a single-node Kafka cluster with ephemeral storage — appropriate for development. Production clusters use persistent storage and 3+ replicas.

```bash
kubectl apply -f examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml

# Wait for the cluster to become ready (~2-3 minutes)
kubectl wait kafka/eip-kafka --for=condition=Ready -n kafka --timeout=300s
```

Create the topics:

```bash
kubectl apply -f examples/38-kubernetes-deploy/k8s-infra/kafka-topics.yaml
```

This creates `eip.orders.incoming` and `eip.orders.enriched`, each with 3 partitions.

### Redis

Deploy a standalone Redis instance via the Bitnami Helm chart, with authentication disabled for simplicity:

```bash
helm install redis oci://registry-1.docker.io/bitnamicharts/redis \
  -n redis --create-namespace \
  --set auth.enabled=false \
  --set architecture=standalone \
  --set master.resources.requests.memory=128Mi \
  --set master.resources.limits.memory=256Mi \
  --wait --timeout 300s
```

Verify both services are running:

```bash
kubectl get pods -n kafka    # eip-kafka-kafka-0 should be Running
kubectl get pods -n redis    # redis-master-0 should be Running
```

## The example application

The example is an order-processing pipeline with three Camel routes:

| Route | Role |
|-------|------|
| **OrderApiRoute** | REST endpoint: `POST /api/orders` → publishes to Kafka `eip.orders.incoming` |
| **OrderProcessorRoute** | Kafka consumer → enriches each order with customer name from Redis → publishes to `eip.orders.enriched` |
| **CacheLoaderRoute** | Timer (runs once at startup) → pre-populates Redis with sample customer records |

The route logic is identical across runtimes — only the class annotations and Redis API differ:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
@ApplicationScoped
public class OrderProcessorRoute extends RouteBuilder {

    @Inject
    RedisAPI redis;

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=k8s-order-processor&autoOffsetReset=earliest")
            .routeId("order-processor")
            .log("Processing order: ${body}")
            .unmarshal().json(JsonLibrary.Jackson, Map.class)
            .process(this::enrichFromCache)
            .marshal().json(JsonLibrary.Jackson)
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}")
            .log("Enriched order published: ${body}");
    }
}
```

```java
@Component
public class OrderProcessorRoute extends RouteBuilder {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    public void configure() {
        from("kafka:eip.orders.incoming?brokers={{kafka.brokers}}&groupId=k8s-order-processor&autoOffsetReset=earliest")
            .routeId("order-processor")
            .log("Processing order: ${body}")
            .unmarshal().json(JsonLibrary.Jackson, Map.class)
            .process(this::enrichFromCache)
            .marshal().json(JsonLibrary.Jackson)
            .to("kafka:eip.orders.enriched?brokers={{kafka.brokers}}")
            .log("Enriched order published: ${body}");
    }
}
```

The `enrichFromCache` method looks up `customer:<customerId>` in Redis and adds the customer name to the order. On a cache miss, it falls back to a default value — in production, you'd call a customer service here.

## Building container images

The first step toward Kubernetes is packaging the application as a container image.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus — Jib builds an image without a Docker daemon
cd examples/38-kubernetes-deploy/quarkus

mvn package -DskipTests \
  -Dquarkus.container-image.build=true \
  -Dquarkus.container-image.group=eip \
  -Dquarkus.container-image.name=eip-k8s-deploy \
  -Dquarkus.container-image.tag=latest

# Verify the image
docker images | grep eip-k8s-deploy
```

```bash
# Spring Boot — Cloud Native Buildpacks (no Dockerfile needed)
cd examples/38-kubernetes-deploy/spring-boot

mvn spring-boot:build-image -DskipTests \
  -Dspring-boot.build-image.imageName=eip/eip-kubernetes-deploy-springboot:latest

# Verify the image
docker images | grep eip-kubernetes-deploy
```

**Quarkus** uses the `quarkus-container-image-jib` extension. Jib builds OCI images without requiring a Docker daemon, produces reproducible builds, and efficiently caches Maven dependency layers. The image configuration lives in `application.properties`:

```properties
quarkus.container-image.builder=jib
quarkus.container-image.group=eip
quarkus.container-image.name=eip-k8s-deploy
quarkus.container-image.tag=latest
```

**Spring Boot** uses Cloud Native Buildpacks via `spring-boot:build-image`. This analyzes the JAR, selects appropriate base images and JVM settings, and produces a layered image — all without a Dockerfile.

> **Podman users:** If `spring-boot:build-image` fails to connect to a Docker daemon, set `DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock` or build with a Dockerfile instead.

## Kubernetes manifests

With the image built, you need Kubernetes resources to deploy it.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus — the quarkus-kubernetes extension generates manifests automatically
cd examples/38-kubernetes-deploy/quarkus

mvn package -DskipTests
cat target/kubernetes/kubernetes.yml
```

```bash
# Spring Boot — hand-written manifests in the k8s/ directory
ls examples/38-kubernetes-deploy/spring-boot/k8s/
# configmap.yaml  deployment.yaml  service.yaml
```

### Quarkus: generated manifests

The `quarkus-kubernetes` extension reads properties from `application.properties` and generates a complete `Deployment`, `Service`, and optional `ConfigMap` at build time. Key configuration:

```properties
quarkus.kubernetes.namespace=default
quarkus.kubernetes.replicas=1
quarkus.kubernetes.resources.requests.cpu=250m
quarkus.kubernetes.resources.requests.memory=256Mi
quarkus.kubernetes.resources.limits.cpu=500m
quarkus.kubernetes.resources.limits.memory=512Mi
```

Health probes are auto-configured when `camel-quarkus-microprofile-health` is on the classpath — the extension wires liveness and readiness checks into the generated manifest.

### Spring Boot: hand-written manifests

The Spring Boot variant includes manifests in `k8s/` that you write and version-control. This is educational — you see exactly what Kubernetes resources your application needs.

**`configmap.yaml`** externalizes the connection settings:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: eip-k8s-config
data:
  KAFKA_BROKERS: "eip-kafka-kafka-bootstrap.kafka.svc.cluster.local:9092"
  SPRING_DATA_REDIS_HOST: "redis-master.redis.svc.cluster.local"
  SPRING_DATA_REDIS_PORT: "6379"
```

**`deployment.yaml`** defines the pod spec with health probes:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: eip-k8s-deploy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: eip-k8s-deploy
  template:
    metadata:
      labels:
        app: eip-k8s-deploy
    spec:
      containers:
        - name: eip-k8s-deploy
          image: eip/eip-kubernetes-deploy-springboot:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 8088
          envFrom:
            - configMapRef:
                name: eip-k8s-config
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /actuator/health/liveness
              port: 8088
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /actuator/health/readiness
              port: 8088
            initialDelaySeconds: 15
            periodSeconds: 5
```

Note `imagePullPolicy: Never` — this tells Kubernetes to use the locally-built image rather than pulling from a registry. In production, you'd push to a registry and use `IfNotPresent` or `Always`.

## Deploying to the cluster

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Option 1: Deploy in one step (build + deploy)
mvn package -DskipTests -Dquarkus.kubernetes.deploy=true

# Option 2: Apply the generated manifest manually
kubectl apply -f target/kubernetes/kubernetes.yml
```

```bash
# Apply all three manifests
kubectl apply -f examples/38-kubernetes-deploy/spring-boot/k8s/
```

Watch the pod start up:

```bash
kubectl get pods -w
# NAME                              READY   STATUS    RESTARTS   AGE
# eip-k8s-deploy-5b8f9c4d6-x7k2m   1/1     Running   0          30s
```

## Verifying the deployment

Once the pod is running, verify the full pipeline:

```bash
# Follow the application logs
kubectl logs -f deployment/eip-k8s-deploy

# Port-forward to access the REST endpoint
kubectl port-forward svc/eip-k8s-deploy 8088:80
```

In another terminal, submit a test order:

```bash
curl -X POST http://localhost:8088/api/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
```

You should see in the logs:
1. **OrderApiRoute** receives the order and publishes to `eip.orders.incoming`
2. **OrderProcessorRoute** consumes from Kafka, enriches with customer name "Global Freight Ltd" from Redis, and publishes to `eip.orders.enriched`

Check health probes:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
curl http://localhost:8088/q/health
# {"status":"UP","checks":[{"name":"camel-readiness-checks","status":"UP"}, ...]}
```

```bash
curl http://localhost:8088/actuator/health
# {"status":"UP","components":{"camelHealth":{"status":"UP"}, ...}}
```

## Scaling and consumer groups

One of the primary reasons to deploy to Kubernetes is horizontal scaling. Kafka consumer groups make this straightforward:

```bash
# Scale to 3 replicas
kubectl scale deployment/eip-k8s-deploy --replicas=3

# Watch the pods come up
kubectl get pods -w
```

When the new pods start, Kafka triggers a consumer group rebalance. The 3 partitions of `eip.orders.incoming` are distributed across the 3 pods — each pod processes a subset of the partitions. Watch the logs to see partition assignments:

```bash
kubectl logs -f deployment/eip-k8s-deploy --all-containers --prefix
```

Scaling back down reverses the process — Kafka redistributes partitions to the remaining consumers.

> **Partition count = max parallelism.** Our topics have 3 partitions, so scaling beyond 3 replicas means some pods will be idle Kafka consumers. For higher throughput, increase the partition count when creating the topic.

## Externalized configuration

The `application.properties` in the container image uses `localhost` for Kafka and Redis — fine for local development. Inside the cluster, the ConfigMap overrides these via environment variables.

Spring Boot automatically maps environment variables to properties: `KAFKA_BROKERS` overrides `kafka.brokers`, `SPRING_DATA_REDIS_HOST` overrides `spring.data.redis.host`.

Quarkus does the same — environment variables take precedence over `application.properties` values following the MicroProfile Config specification.

For sensitive data like Redis passwords, use a Kubernetes `Secret` instead of a ConfigMap:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: eip-k8s-secrets
type: Opaque
stringData:
  REDIS_PASSWORD: "your-redis-password"
```

Reference it in the Deployment with `secretRef` alongside `configMapRef`.

## Cleanup

Remove the application and infrastructure when you're done:

```bash
# Remove the Camel application
kubectl delete deployment/eip-k8s-deploy
kubectl delete svc/eip-k8s-deploy
kubectl delete configmap/eip-k8s-config

# Remove infrastructure
helm uninstall redis -n redis
kubectl delete -f examples/38-kubernetes-deploy/k8s-infra/kafka-topics.yaml
kubectl delete -f examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml
helm uninstall strimzi -n kafka
kubectl delete namespace kafka redis

# Or tear down everything at once
./scripts/setup-minikube-stack.sh --clean
```

## What you learned

- **Container image builds** — Jib (Quarkus) and Cloud Native Buildpacks (Spring Boot) produce OCI images without manual Dockerfiles
- **Manifest generation** — Quarkus auto-generates Kubernetes resources from `application.properties`; Spring Boot uses hand-written YAMLs that are explicit and version-controlled
- **Health probes** — MicroProfile Health and Spring Boot Actuator provide liveness and readiness checks that Kubernetes uses for pod lifecycle management
- **Scaling** — `kubectl scale` combined with Kafka consumer groups gives you horizontal scaling with automatic partition rebalancing
- **Externalized configuration** — ConfigMaps and Secrets override application properties inside the cluster without rebuilding the image

## References

- [Quarkus Kubernetes guide](https://quarkus.io/guides/deploying-to-kubernetes)
- [Quarkus Container Images guide](https://quarkus.io/guides/container-image)
- [Spring Boot Container Images](https://docs.spring.io/spring-boot/reference/packaging/container-images/cloud-native-buildpacks.html)
- [Strimzi documentation](https://strimzi.io/documentation/)
- [Bitnami Redis Helm chart](https://github.com/bitnami/charts/tree/main/bitnami/redis)

---

*Verification status: unverified. Spring Boot variant compiles against Spring Boot 4.0.7, Camel 4.20.0. Quarkus variant compiles against Quarkus 3.37.0, Camel 4.20.0.*
