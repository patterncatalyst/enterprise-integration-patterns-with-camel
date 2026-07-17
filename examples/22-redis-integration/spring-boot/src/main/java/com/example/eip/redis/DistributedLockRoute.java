package com.example.eip.redis;

import java.time.Duration;
import java.util.UUID;

import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class DistributedLockRoute extends RouteBuilder {

    private static final String LOCK_KEY = "lock:nightly-order-export";
    private static final long LOCK_TTL_SECONDS = 30;

    private final String instanceId = UUID.randomUUID().toString();

    @Autowired
    StringRedisTemplate redisTemplate;

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
        Boolean acquired = redisTemplate.opsForValue()
            .setIfAbsent(LOCK_KEY, instanceId, Duration.ofSeconds(LOCK_TTL_SECONDS));
        exchange.getIn().setHeader("LockAcquired", Boolean.TRUE.equals(acquired));
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
        String currentValue = redisTemplate.opsForValue().get(LOCK_KEY);
        if (instanceId.equals(currentValue)) {
            redisTemplate.delete(LOCK_KEY);
        }
    }
}
