package com.example.eip.endpoints;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class ServiceActivatorRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.deduplicated?brokers={{kafka.brokers}}&groupId=activator-demo")
            .routeId("service-activator")
            .unmarshal().json()
            .log("Invoking inventory check for order ${body[order_id]}")
            .bean(InventoryService.class, "checkStock")
            .log("Inventory result: ${body}")
            .marshal().json()
            .to("kafka:eip.orders.inventory-checked?brokers={{kafka.brokers}}");
    }
}
