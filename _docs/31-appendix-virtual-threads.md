---
title: "Appendix M: Virtual Threads for Camel Workloads"
order: 31
part: appendices
description: "How Java virtual threads work under the hood, and how they transform throughput for I/O-bound Camel routes on Quarkus."
duration: "30 minutes"
---

Integration routes spend most of their time waiting — waiting for Kafka to acknowledge a produce, waiting for an HTTP enrichment service to respond, waiting for a JDBC query to return rows. Platform threads block during every one of those waits, and each blocked thread consumes roughly 1 MB of stack memory plus an OS scheduling slot. A Camel application with 200 concurrent routes processing I/O-bound messages needs 200 platform threads just to block. Virtual threads change the economics entirely: a virtual thread costs about 1 KB of stack, parks for free when it hits I/O, and resumes on any available carrier thread when the I/O completes. The same 200-route application can now run thousands of concurrent messages with a handful of carrier threads.

{% include excalidraw.html file="31-virtual-threads" alt="Platform threads vs virtual threads: 1:1 OS mapping vs M:N scheduling with carrier pool" caption="Figure M.1 — Platform threads map 1:1 to OS threads; virtual threads share a small carrier pool and park on I/O" %}

## How virtual threads work

A platform thread is a thin wrapper around an OS thread. Creating one allocates a ~1 MB stack, registers a kernel-level scheduling entity, and ties the JVM thread to that OS thread for its entire lifetime. The OS scheduler decides which platform threads run on which CPU cores. This 1:1 mapping is simple and well-understood, but it means the maximum number of concurrent threads is bounded by OS resources — typically a few thousand before memory pressure or scheduler overhead degrades performance.

Virtual threads break the 1:1 mapping. The JVM maintains a small pool of platform threads called **carrier threads** (backed by a `ForkJoinPool`). Virtual threads are scheduled onto carrier threads by the JVM, not the OS. When a virtual thread executes application code, it is **mounted** on a carrier thread. When it blocks on I/O — a socket read, a file write, a `Thread.sleep()` — the JVM **unmounts** it from the carrier thread, saves its stack (the **continuation**), and frees the carrier to run another virtual thread.

The key insight is that unmounting is a JVM-level operation, not an OS context switch. The virtual thread's continuation (its saved stack frames) is stored on the Java heap as a regular object. When the I/O completes, the JVM re-mounts the continuation onto any available carrier thread and resumes execution. The application code sees a blocking call that returned — it has no idea it was unmounted and re-mounted in between.

This M:N scheduling model (M virtual threads onto N carrier threads, where M >> N) means:

- **Memory**: a virtual thread starts with ~1 KB of stack (grows as needed) vs ~1 MB for a platform thread
- **Creation**: creating a virtual thread is roughly equivalent to allocating a small object — microseconds, not milliseconds
- **Blocking**: a blocked virtual thread consumes zero OS resources; only the heap-allocated continuation remains
- **Carrier pool**: the default carrier pool size equals the number of available processors, tunable via `-Djdk.virtualThreadScheduler.parallelism`

```java
// Creating a virtual thread is lightweight
Thread.ofVirtual().name("order-processor-", 0).start(() -> {
    // This code runs on a virtual thread
    processOrder(order);  // blocks on JDBC — virtual thread parks, carrier freed
});

// Or use an executor for pool-style management
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Order order : orders) {
        executor.submit(() -> processOrder(order));  // thousands of concurrent tasks
    }
}
```

## Pinning — when virtual threads lose their advantage

Virtual threads cannot unmount from their carrier thread in two situations:

1. **Inside a `synchronized` block or method** (JDK < 24): the virtual thread is *pinned* to its carrier thread for the duration of the synchronized section. If the code inside the block performs blocking I/O, the carrier thread is blocked too — defeating the purpose of virtual threads.

2. **During a native method call**: JNI calls pin the virtual thread because the native code may hold references to the thread's stack.

**JDK 24 resolved most pinning** by reimplementing object monitors to allow virtual threads to unmount even inside `synchronized` blocks. If you are running JDK 24 or later, pinning from `synchronized` is no longer a concern for most code.

For earlier JDK versions, replace `synchronized` with `ReentrantLock` in any code that performs blocking I/O:

```java
// Pinning risk on JDK < 24: blocks carrier thread during I/O
synchronized (lock) {
    result = jdbcTemplate.queryForObject(sql, Order.class);  // pins!
}

// Safe on all JDK versions: allows unmounting during I/O
lock.lock();
try {
    result = jdbcTemplate.queryForObject(sql, Order.class);  // parks cleanly
} finally {
    lock.unlock();
}
```

### Detecting pinning

Use the JVM flag to log pinning events:

```bash
java -Djdk.tracePinnedThreads=short -jar myapp.jar
```

This prints a stack trace whenever a virtual thread pins its carrier. JDK Flight Recorder also captures `jdk.VirtualThreadPinned` events for production monitoring without the logging overhead.

## Enabling virtual threads in Camel

Apache Camel supports virtual threads as an opt-in feature. Add one property to your Quarkus `application.properties`:

```properties
# Enable virtual threads for Camel thread pools
camel.main.virtualThreadsEnabled=true
```

When this property is set (and you are running on JDK 25+), Camel's `DefaultThreadPoolFactory` changes its behavior:

| Pool type | Platform threads | Virtual threads |
|-----------|-----------------|-----------------|
| Cached pool | `Executors.newCachedThreadPool()` | `Executors.newThreadPerTaskExecutor()` |
| Bounded queue (maxQueueSize > 0) | `ThreadPoolExecutor` with queue | `newThreadPerTaskExecutor()` + `Semaphore(maxQueueSize)` |
| Unbounded (maxQueueSize ≤ 0) | `ThreadPoolExecutor` with `SynchronousQueue` | Unbounded `newThreadPerTaskExecutor()` |
| Scheduled | `ScheduledThreadPoolExecutor` | **Still uses platform threads** |
| Single thread | Single platform thread | **Still uses platform thread** |

The key differences: bounded pools no longer queue tasks — instead, a semaphore caps concurrency, and all permitted tasks execute immediately on virtual threads. Scheduled and single-threaded executors remain on platform threads because virtual threads target concurrent I/O-bound work, not sequential or timed operations.

For Quarkus REST endpoints, you can additionally use the `@RunOnVirtualThread` annotation:

```properties
# Quarkus virtual thread configuration
quarkus.virtual-threads.name-prefix=eip-vt-
```

## SEDA with virtual threads — the key integration pattern

The SEDA (Staged Event-Driven Architecture) component is where virtual threads have the biggest impact in Camel. SEDA provides an in-memory queue between route segments, decoupling producers from consumers.

### Traditional fixed pool

With platform threads, SEDA uses a fixed number of long-running consumer threads that poll the queue continuously:

```java
from("kafka:eip.orders.placed?groupId=order-processor")
    .to("seda:process-order?concurrentConsumers=10");

from("seda:process-order?concurrentConsumers=10")
    .routeId("order-processor")
    .bean(inventoryService, "reserveStock")       // JDBC call — blocks
    .enrich("http://payment-service/validate")     // HTTP call — blocks
    .bean(orderRepository, "updateStatus")         // JDBC call — blocks
    .to("kafka:eip.orders.processed");
```

With 10 platform threads, you can process at most 10 orders concurrently. Each thread spends most of its time blocked on JDBC and HTTP calls. If a payment service call takes 200 ms, each thread processes ~5 orders per second, for a total throughput of ~50 orders per second.

### Virtual thread per task

With virtual threads, SEDA spawns a new virtual thread for each message. The `concurrentConsumers` parameter becomes a concurrency limit rather than a thread count:

```java
from("kafka:eip.orders.placed?groupId=order-processor")
    .to("seda:process-order");

from("seda:process-order?virtualThreadPerTask=true&concurrentConsumers=500")
    .routeId("order-processor-vt")
    .bean(inventoryService, "reserveStock")       // parks virtual thread
    .enrich("http://payment-service/validate")     // parks virtual thread
    .bean(orderRepository, "updateStatus")         // parks virtual thread
    .to("kafka:eip.orders.processed");
```

Now 500 orders can be processed concurrently, each on its own virtual thread. When `reserveStock` blocks on JDBC, the virtual thread parks and its carrier thread picks up another order. The same ~4 carrier threads (on a 4-core machine) handle 500 concurrent orders because every blocking call is an opportunity to switch.

### Backpressure

Virtual threads make it easy to overwhelm downstream services. SEDA provides layered backpressure:

```java
// Layer 1: Queue-based (producer side)
// Buffer up to 10,000 messages; block callers for up to 30s when full
from("rest:post:/orders")
    .to("seda:order-queue?size=10000&blockWhenFull=true&offerTimeout=30000");

// Layer 2: Concurrency limiting (consumer side)
// At most 500 concurrent virtual threads processing orders
from("seda:order-queue?virtualThreadPerTask=true&concurrentConsumers=500")
    .bean(inventoryService, "reserveStock")
    .enrich("http://payment-service/validate")
    .bean(orderRepository, "updateStatus")
    .to("kafka:eip.orders.processed");
```

The queue absorbs bursts; the concurrency limit prevents downstream flooding. Together they create a robust pipeline that handles variable load without circuit breakers or manual throttling.

## Virtual threads and Kafka consumers

Kafka consumer threads in Camel benefit from virtual threads in two ways. First, Camel's thread pool for processing consumed messages switches to virtual threads automatically when `camel.main.virtualThreadsEnabled=true`. Second, you can use SEDA with virtual threads as a processing buffer between the Kafka consumer and your I/O-heavy business logic:

```java
from("kafka:eip.orders.placed"
        + "?groupId=shipping-processor"
        + "&consumersCount=3")
    .routeId("kafka-to-seda")
    .to("seda:ship-order");

from("seda:ship-order?virtualThreadPerTask=true&concurrentConsumers=200")
    .routeId("ship-order-vt")
    .bean(addressLookup, "resolveAddress")         // HTTP call to geocoding API
    .bean(carrierService, "selectCarrier")          // JDBC lookup
    .bean(labelService, "generateLabel")            // HTTP call to label printer
    .bean(shipmentRepository, "saveShipment")       // JDBC insert
    .to("kafka:eip.shipments.dispatched");
```

Three Kafka consumer threads feed the SEDA queue. Two hundred virtual threads process shipments concurrently. Each virtual thread parks four times (two HTTP calls, two JDBC calls) per message, but the carrier threads stay busy serving other virtual threads during those waits.

## Virtual threads and Quarkus REST

Quarkus REST endpoints run on the Vert.x event loop by default. For endpoints that call blocking code (JDBC, synchronous HTTP clients), annotate them with `@RunOnVirtualThread` to offload execution:

```java
@Path("/api/orders")
@ApplicationScoped
public class OrderResource {

    @Inject
    ProducerTemplate producerTemplate;

    @POST
    @RunOnVirtualThread
    public Response createOrder(Order order) {
        // This runs on a virtual thread — safe to block
        producerTemplate.sendBody("direct:new-order", order);
        return Response.accepted().build();
    }
}
```

For Camel REST DSL, use the `.threads()` DSL to offload blocking work from the Vert.x event loop:

```java
rest("/api")
    .post("/orders").type(Order.class)
        .to("direct:new-order");

from("direct:new-order")
    .routeId("new-order-processor")
    .threads()  // offload from event loop to worker/virtual thread
    .bean(orderService, "validate")
    .to("kafka:eip.orders.placed");
```

When `camel.main.virtualThreadsEnabled=true` is set, the `.threads()` DSL creates virtual threads instead of platform worker threads.

## Context propagation

Camel provides a `ContextValue` abstraction that selects the optimal thread-local mechanism based on the JDK version:

| JDK version | Virtual threads enabled | Implementation |
|-------------|----------------------|----------------|
| 17–24 | N/A | `ThreadLocal` |
| 25+ | Yes | `ScopedValue` (JEP 487) |
| 25+ | No | `ThreadLocal` |

`ScopedValue` is a better fit for virtual threads because it is immutable within a scope, inheritable by child tasks, and has lower overhead than `ThreadLocal` for short-lived threads.

**Critical limitation**: `ContextValue` does *not* propagate across asynchronous boundaries like SEDA queues, `direct-vm:`, or Kafka topics. For cross-route context, use exchange properties or message headers:

```java
from("direct:process-order")
    .setProperty("tenantId", constant("acme-corp"))
    .to("seda:enrich-order");

from("seda:enrich-order?virtualThreadPerTask=true&concurrentConsumers=100")
    .process(exchange -> {
        // Safe: exchange properties survive across SEDA boundaries
        String tenant = exchange.getProperty("tenantId", String.class);
        enrichForTenant(exchange, tenant);
    })
    .to("kafka:eip.orders.enriched");
```

## When NOT to use virtual threads

Virtual threads improve throughput for I/O-bound workloads. They provide no benefit — and can add overhead — for:

- **CPU-bound computation**: tight loops, encryption, compression, JSON serialization of large payloads. These tasks never block, so there is nothing to park on. Use platform threads with a bounded pool sized to your CPU core count.

- **Real-time or low-latency requirements**: virtual thread scheduling adds a small but non-deterministic delay (the carrier pool must schedule the resume). For sub-millisecond latency requirements, dedicated platform threads with thread affinity are more predictable.

- **JNI-heavy native code**: native method calls pin the virtual thread. If your route calls a native library that blocks for significant time (image processing via OpenCV, ML inference via ONNX Runtime), you negate the benefit of virtual threads.

- **Lock-heavy code on JDK < 24**: if your route calls third-party libraries that use `synchronized` extensively around blocking operations, every synchronized section pins the carrier. Audit your dependency tree for pinning before enabling virtual threads.

A practical rule: if your route's critical path has more wall-clock time in I/O waits than in computation, virtual threads will help. If it is the reverse, stick with platform threads.

## Monitoring virtual threads

### Thread naming

Quarkus names its managed virtual threads with a `quarkus-virtual-thread-` prefix (configurable via `quarkus.virtual-threads.name-prefix`). Camel's virtual threads follow the Camel thread naming convention. Use thread names in logs and thread dumps to distinguish virtual from platform threads.

### Pinning detection

For development and testing:

```bash
# Log pinning events to stderr
java -Djdk.tracePinnedThreads=short \
     -Dcamel.main.virtualThreadsEnabled=true \
     -jar target/quarkus-app/quarkus-run.jar
```

For production monitoring, enable JDK Flight Recorder:

```bash
java -XX:StartFlightRecording=filename=recording.jfr,duration=60s \
     -jar target/quarkus-app/quarkus-run.jar
```

Then analyze with `jfr print --events jdk.VirtualThreadPinned recording.jfr` to find pinning hotspots.

### Grafana dashboards

When the LGTM observability stack is running (`./scripts/setup-stack.sh --lgtm`), JVM metrics exported via Micrometer include:

- `jvm.threads.daemon` / `jvm.threads.live` — platform thread counts (virtual threads are not counted here)
- `jvm.threads.started` — total threads started (includes virtual)
- Custom Camel metrics: `camel.exchanges.inflight` shows concurrent processing load

Virtual threads are intentionally lightweight and not individually tracked by JMX. Monitor throughput and latency at the route level rather than counting virtual threads.

### Thread dumps

Virtual threads appear in `jcmd <pid> Thread.dump_to_file -format=json <file>` output. The JSON format groups virtual threads by their state (running, parked, pinned) and shows which carrier thread each running virtual thread is mounted on.

---

*Verification status: <span class="status status--verified">verified</span> — conceptual reference chapter, no runnable example.*
