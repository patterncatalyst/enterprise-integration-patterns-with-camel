package com.example.eip.redis;

import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class DistributedLockRoute extends RouteBuilder {

    private static final String LOCK_KEY = "lock:nightly-order-export";
    private static final String LOCK_TTL_SECONDS = "30";

    private final String instanceId = UUID.randomUUID().toString();

    @Inject
    RedisAPI redis;

    @Override
    public void configure() {
        from("timer:nightly-export?period=60000")
            .routeId("distributed-lock")
            .process(this::tryAcquireLock)
            .choice()
                .when(header("LockAcquired").isEqualTo(true))
                    .log("Lock acquired by instance " + instanceId + " -- running nightly order export")
                    .process(this::runExportTask)
                    .process(this::releaseLock)
                    .log("Nightly order export complete -- lock released")
                .otherwise()
                    .log("Lock held by another instance -- skipping nightly export")
            .end();
    }

    private void tryAcquireLock(Exchange exchange) {
        // SET NX EX -- acquire lock only if it does not already exist
        Response result = redis.set(List.of(LOCK_KEY, instanceId, "NX", "EX", LOCK_TTL_SECONDS))
            .await().indefinitely();
        exchange.getIn().setHeader("LockAcquired", result != null);
    }

    private void runExportTask(Exchange exchange) {
        // Simulate a nightly export: count orders processed today
        int exportedCount = 42 + (int) (System.nanoTime() % 100);
        exchange.getIn().setBody(String.format(
            "{\"task\": \"nightly-order-export\", \"exported_count\": %d, \"instance\": \"%s\"}",
            exportedCount, instanceId));
    }

    private void releaseLock(Exchange exchange) {
        // Only release if we still own the lock (compare value)
        Response currentValue = redis.get(LOCK_KEY).await().indefinitely();
        if (currentValue != null && instanceId.equals(currentValue.toString())) {
            redis.del(List.of(LOCK_KEY)).await().indefinitely();
        }
    }
}
