package com.example.eip.endpoints;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.support.processor.idempotent.MemoryIdempotentRepository;

@ApplicationScoped
public class IdempotentReceiverRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=idempotent-demo")
            .routeId("idempotent-receiver")
            .unmarshal().json()
            .idempotentConsumer(jsonpath("$.order_id"),
                MemoryIdempotentRepository.memoryIdempotentRepository(200))
            .log("Processing unique order ${body[order_id]}")
            .marshal().json()
            .to("kafka:eip.orders.deduplicated?brokers={{kafka.brokers}}");
    }
}
