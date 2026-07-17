package com.example.eip.redis;

import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.mutiny.redis.client.Response;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;

import java.util.List;
import java.util.Map;

@ApplicationScoped
public class IdempotentReceiverRoute extends RouteBuilder {

    @Inject
    RedisAPI redis;

    @Override
    public void configure() {
        from("kafka:eip.orders.payments?brokers={{kafka.brokers}}&groupId=redis-idempotent")
            .routeId("idempotent-receiver")
            .unmarshal().json(Map.class)
            .process(this::deduplicateAndProcess)
            .choice()
                .when(header("CamelDuplicate").isEqualTo(true))
                    .log("Duplicate payment event ${body[event_id]} -- skipping")
                .otherwise()
                    .log("Processing payment event ${body[event_id]} for order ${body[order_id]}")
                    .marshal().json()
                    .to("kafka:eip.orders.payment-confirmed?brokers={{kafka.brokers}}")
            .end();
    }

    private void deduplicateAndProcess(Exchange exchange) {
        @SuppressWarnings("unchecked")
        Map<String, Object> event = exchange.getIn().getBody(Map.class);
        String eventId = String.valueOf(event.get("event_id"));
        String dedupeKey = "idempotent:" + eventId;

        // SET NX with a 24-hour TTL -- returns null if the key already exists
        Response result = redis.set(List.of(dedupeKey, "1", "NX", "EX", "86400"))
            .await().indefinitely();

        boolean isDuplicate = (result == null);
        exchange.getIn().setHeader("CamelDuplicate", isDuplicate);
    }
}
