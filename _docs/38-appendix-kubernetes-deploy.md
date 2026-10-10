---
title: "Appendix T: Deploying Camel to Kubernetes"
order: 38
part: appendices
description: "Standard Maven builds, Containerfile images and Kubernetes deployments for Camel applications — Quarkus and Spring Boot on minikube (docker driver, containerd) with Strimzi Kafka and Redis."
duration: "45 minutes"
---

Every chapter in this tutorial runs against a local compose stack. But production Camel applications run on Kubernetes. This appendix covers the full deployment lifecycle — building container images, generating manifests, deploying to a real cluster, scaling, and externalizing configuration — using standard Maven tooling and a `Containerfile` per runtime. The only operator is Strimzi, for Kafka.

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

{% include excalidraw.html file="38-kubernetes-deploy" alt="minikube cluster with Camel application pods, Strimzi Kafka, and Redis" caption="Figure T.1 — Kubernetes deployment architecture: the Camel application consumes orders from Kafka, enriches via Redis, and publishes to an enriched orders topic." %}

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

The cluster runs on Docker Engine (`docker-ce`, docker context `default`) with
minikube's `docker` driver and the containerd runtime inside the node. No
desktop application is involved. Fedora and RHEL hosts.

```bash
docker context show   # default
minikube version      # v1.39.0+
kubectl version       # client v1.36.x
helm version          # v3.18+ or v4
java -version         # 25+
mvn -version          # 3.9+
jq --version
```

One local cluster at a time: stop OpenShift Local (`crc stop`) before
creating the profile; the setup script refuses to run beside it.

## The minikube profile

The setup script creates a dedicated profile, `eip`, and passes every setting
on the command line. It never runs `minikube config set`, which would change
minikube's global defaults for every other project on the machine:

```bash
minikube start -p eip \
  --driver=docker --container-runtime=containerd \
  --kubernetes-version=v1.36.5 \
  --cpus=4 --memory=8192 \
  --ports=127.0.0.1:30088:30088
```

Two choices in that command matter later:

- **`--container-runtime=containerd`.** The node runs containerd, not a
  Docker daemon, so `eval $(minikube docker-env)` has nothing to talk to.
  Images are built on the host with `docker build` and copied into the node
  with `minikube -p eip image load`.
- **`--ports=127.0.0.1:30088:30088`.** The application's Service is a NodePort
  on 30088, and this publishes it on the host's loopback when the profile is
  created. `http://127.0.0.1:30088` reaches the Service directly — no
  `kubectl port-forward`, no `minikube tunnel`, no `minikube service`, all of
  which drop mid-session. Ports are fixed at creation; adding one means
  recreating the profile (`--replace`).

Every later command names its target explicitly — `minikube -p eip`,
`kubectl --context eip`, `helm --kube-context eip` — so nothing depends on, or
changes, your current kubectl context.

The script does all of this, plus the infrastructure below:

```bash
./scripts/setup-minikube-stack.sh
```

## Deploying infrastructure

The example needs Kafka and Redis running inside the cluster.

### Strimzi Kafka

[Strimzi](https://strimzi.io) deploys and manages Kafka on Kubernetes via custom resources. Install the operator from its OCI Helm chart, pinned:

```bash
helm --kube-context eip upgrade --install strimzi \
  oci://quay.io/strimzi-helm/strimzi-kafka-operator --version 1.2.0 \
  -n kafka --create-namespace --wait --timeout 300s
```

Strimzi 1.x serves only the `kafka.strimzi.io/v1` API, and KRaft is the only
mode: there is no ZooKeeper block, and the broker and controller roles live on
a `KafkaNodePool`. The cluster from `examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml`:

```yaml
apiVersion: kafka.strimzi.io/v1
kind: KafkaNodePool
metadata:
  name: dual-role
  namespace: kafka
  labels:
    strimzi.io/cluster: eip-kafka
spec:
  replicas: 1
  roles:
    - controller
    - broker
  storage:
    type: ephemeral
---
apiVersion: kafka.strimzi.io/v1
kind: Kafka
metadata:
  name: eip-kafka
  namespace: kafka
spec:
  kafka:
    version: 4.3.1
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
  entityOperator:
    topicOperator: {}
```

One dual-role node with ephemeral storage is appropriate for development. Production clusters use separate controller and broker pools, persistent storage and three or more replicas.

```bash
kubectl --context eip apply -f examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml
kubectl --context eip wait kafka/eip-kafka --for=condition=Ready -n kafka --timeout=600s
```

Create the topics:

```bash
kubectl --context eip apply -f examples/38-kubernetes-deploy/k8s-infra/kafka-topics.yaml
```

This creates `eip.orders.incoming` and `eip.orders.enriched`, each with 3 partitions.

### Redis

Redis runs from the official image as a plain Deployment and Service in its
own namespace (`k8s-infra/redis.yaml`): one replica, no persistence, no
authentication — development only.

```bash
kubectl --context eip apply -f examples/38-kubernetes-deploy/k8s-infra/redis.yaml
kubectl --context eip rollout status deployment/redis -n redis
```

Verify both:

```bash
kubectl --context eip get pods -n kafka    # eip-kafka-dual-role-0 Running
kubectl --context eip get pods -n redis    # redis-... Running
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

{% raw %}
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
{% endraw %}

{% raw %}
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
{% endraw %}

The `enrichFromCache` method looks up `customer:<customerId>` in Redis and adds the customer name to the order. On a cache miss, it falls back to a default value — in production, you'd call a customer service here.

## Building container images

Each runtime directory carries a `Containerfile` that copies the Maven build
output onto a pinned UBI 10 OpenJDK 25 runtime image
(`registry.access.redhat.com/ubi10/openjdk-25-runtime:1.24-15`). Build on the
host with Docker Engine, then load the image into the profile's containerd:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
cd examples/38-kubernetes-deploy/quarkus
mvn package -DskipTests
docker build -f Containerfile -t eip/eip-k8s-deploy:1.0 .
minikube -p eip image load eip/eip-k8s-deploy:1.0
```

```bash
cd examples/38-kubernetes-deploy/spring-boot
mvn package -DskipTests
docker build -f Containerfile -t eip/eip-k8s-deploy-springboot:1.0 .
minikube -p eip image load eip/eip-k8s-deploy-springboot:1.0
```

The Quarkus image copies the fast-jar layout (`target/quarkus-app/`) and starts
it with the image's `run-java.sh`; the Spring Boot image runs the executable
jar. Both run as UID 185 and use an exact tag — never `latest` — so a rebuild
is an explicit `image load` followed by `kubectl rollout restart`.

Why not build inside the node? With the containerd runtime there is no Docker
daemon in the node to build against, and handing images between engines is
exactly what `image load` exists for.

## Kubernetes manifests

With the image loaded, you need Kubernetes resources to deploy it.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
# Quarkus — the quarkus-kubernetes extension generates manifests at build time
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

The `quarkus-kubernetes` extension reads properties from `application.properties` and generates a `Deployment` and `Service` at build time. Key configuration:

```properties
quarkus.container-image.group=eip
quarkus.container-image.name=eip-k8s-deploy
quarkus.container-image.tag=1.0

quarkus.kubernetes.namespace=default
quarkus.kubernetes.replicas=1
quarkus.kubernetes.image-pull-policy=never
quarkus.kubernetes.service-type=node-port
quarkus.kubernetes.node-port=30088
quarkus.kubernetes.env.vars.kafka-brokers=eip-kafka-kafka-bootstrap.kafka.svc.cluster.local:9092
quarkus.kubernetes.env.vars.quarkus-redis-hosts=redis://redis.redis.svc.cluster.local:6379
quarkus.kubernetes.resources.requests.cpu=250m
quarkus.kubernetes.resources.requests.memory=256Mi
quarkus.kubernetes.resources.limits.cpu=500m
quarkus.kubernetes.resources.limits.memory=512Mi
```

`env.vars.kafka-brokers` becomes the container variable `KAFKA_BROKERS`, which
overrides `kafka.brokers` from `application.properties`. (The older
`env-vars.<NAME>.value` form is silently ignored by current Quarkus: the
manifest is generated with no such variable, and the pod connects to
`localhost:9092`.) The `container-image` keys only name the image the manifest references; the
image itself comes from the `Containerfile` above. Health probes are
auto-configured because `camel-quarkus-microprofile-health` brings SmallRye
Health — the extension wires `/q/health/live` and `/q/health/ready` into the
generated Deployment.

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
  SPRING_DATA_REDIS_HOST: "redis.redis.svc.cluster.local"
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
          image: eip/eip-k8s-deploy-springboot:1.0
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

**`service.yaml`** is a NodePort on the published port:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: eip-k8s-deploy
spec:
  selector:
    app: eip-k8s-deploy
  ports:
    - port: 8088
      targetPort: 8088
      nodePort: 30088
  type: NodePort
```

Note `imagePullPolicy: Never` — Kubernetes uses the image `minikube image load` put in the node instead of pulling from a registry. In production, you'd push to a registry and use `IfNotPresent` or `Always`.

## Deploying to the cluster

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
kubectl --context eip apply -f examples/38-kubernetes-deploy/quarkus/target/kubernetes/kubernetes.yml
```

```bash
kubectl --context eip apply -f examples/38-kubernetes-deploy/spring-boot/k8s/
```

Both variants deploy as `deployment/eip-k8s-deploy` behind the same NodePort,
so deploying one replaces the other — delete the Deployment first when you
switch, because the two select their pods with different labels and a
Deployment's selector is immutable. Watch the rollout:

```bash
kubectl --context eip rollout status deployment/eip-k8s-deploy
```

`deploy-minikube.sh` does the build, image load, apply and rollout in one
step, then runs the checks in the next section:

```bash
./examples/38-kubernetes-deploy/deploy-minikube.sh quarkus
./examples/38-kubernetes-deploy/deploy-minikube.sh spring-boot
```

## Verifying the deployment

The Service is a NodePort published on the host's loopback, so the API answers
on `127.0.0.1:30088` directly:

```bash
curl -X POST http://127.0.0.1:30088/api/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-001","customerId":"C-101","item":"Shipping Container","quantity":2}'
# {"status":"accepted"}
```

Follow the application logs:

```bash
kubectl --context eip logs -f deployment/eip-k8s-deploy
```

You should see:
1. **OrderApiRoute** receives the order and publishes to `eip.orders.incoming`
2. **OrderProcessorRoute** consumes from Kafka, enriches with customer name "Global Freight Ltd" from Redis, and publishes to `eip.orders.enriched`

Check health probes:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
curl http://127.0.0.1:30088/q/health
# {"status":"UP","checks":[{"name":"camel-readiness-checks","status":"UP"}, ...]}
```

```bash
curl http://127.0.0.1:30088/actuator/health
# {"status":"UP","components":{"camelHealth":{"status":"UP"}, ...}}
```

To read the enriched topic from inside the cluster, exec into the broker pod
instead of exposing Kafka to the host:

```bash
kubectl --context eip exec -n kafka eip-kafka-dual-role-0 -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic eip.orders.enriched --from-beginning --max-messages 1
```

## Scaling and consumer groups

One of the primary reasons to deploy to Kubernetes is horizontal scaling. Kafka consumer groups make this straightforward:

```bash
# Scale to 3 replicas
kubectl --context eip scale deployment/eip-k8s-deploy --replicas=3

# Watch the pods come up
kubectl --context eip get pods -w
```

When the new pods start, Kafka triggers a consumer group rebalance. The 3 partitions of `eip.orders.incoming` are distributed across the 3 pods — each pod processes a subset of the partitions. Watch the logs to see partition assignments:

```bash
kubectl --context eip logs -f deployment/eip-k8s-deploy --all-containers --prefix
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

Remove the application and infrastructure, then stop the profile:

```bash
./scripts/setup-minikube-stack.sh --clean    # app, Kafka, Redis, Strimzi; then minikube stop -p eip
./scripts/setup-minikube-stack.sh --delete   # or remove the profile entirely
```

By hand, the same order — custom resources while their operator still runs:

```bash
kubectl --context eip delete deployment/eip-k8s-deploy service/eip-k8s-deploy
kubectl --context eip delete -f examples/38-kubernetes-deploy/k8s-infra/kafka-topics.yaml
kubectl --context eip delete -f examples/38-kubernetes-deploy/k8s-infra/kafka-cluster.yaml
helm --kube-context eip uninstall strimzi -n kafka
kubectl --context eip delete -f examples/38-kubernetes-deploy/k8s-infra/redis.yaml
minikube stop -p eip
```

## What you learned

- **Container image builds** — a `Containerfile` per runtime on a pinned UBI 10 OpenJDK 25 image, built with `docker build` and loaded into minikube's containerd with `minikube image load`
- **Host access without tunnels** — a NodePort published on `127.0.0.1` when the profile is created
- **Manifest generation** — Quarkus auto-generates Kubernetes resources from `application.properties`; Spring Boot uses hand-written YAMLs that are explicit and version-controlled
- **Health probes** — MicroProfile Health and Spring Boot Actuator provide liveness and readiness checks that Kubernetes uses for pod lifecycle management
- **Scaling** — `kubectl scale` combined with Kafka consumer groups gives you horizontal scaling with automatic partition rebalancing
- **Externalized configuration** — ConfigMaps and Secrets override application properties inside the cluster without rebuilding the image

## References

- [Quarkus Kubernetes guide](https://quarkus.io/guides/deploying-to-kubernetes)
- [minikube: pushing images](https://minikube.sigs.k8s.io/docs/handbook/pushing/)
- [Strimzi documentation](https://strimzi.io/documentation/)
- [Redis official image](https://hub.docker.com/_/redis)

To run the same example on OpenShift, with images built inside the cluster and
Routes instead of NodePorts, see
[Appendix Z]({{ '/docs/44-appendix-openshift-local/' | relative_url }}).

---

*Verification status: <span class="status status--verified">verified</span> — on a fresh minikube profile (Docker Engine, docker driver, containerd, Kubernetes v1.36.5, Strimzi Kafka Ready): both variants built with Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1) deploy, report ready (`/q/health/ready`, `/actuator/health/readiness` → 200) and enrich a test order with `Global Freight Ltd` from Redis; scaled to three replicas, all three pods take partitions (2026-10-09).*
