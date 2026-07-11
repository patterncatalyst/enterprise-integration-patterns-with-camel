package com.example.eip.advanced;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class LoadBalancerRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.loadbalanced?brokers={{kafka.brokers}}&groupId=loadbalancer-demo")
            .routeId("load-balancer-demo")
            .unmarshal().json()
            .log("Load Balancer received order ${body[order_id]}")
            .loadBalance().roundRobin()
                .to("direct:fulfillment-center-east",
                    "direct:fulfillment-center-central",
                    "direct:fulfillment-center-west")
            .end();

        from("direct:fulfillment-center-east")
            .routeId("fulfillment-center-east")
            .log("EAST fulfillment center processing order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("fulfillment_center", "EAST");
                body.put("warehouse_code", "WH-NYC-01");
            })
            .log("Order ${body[order_id]} assigned to EAST (WH-NYC-01)");

        from("direct:fulfillment-center-central")
            .routeId("fulfillment-center-central")
            .log("CENTRAL fulfillment center processing order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("fulfillment_center", "CENTRAL");
                body.put("warehouse_code", "WH-CHI-01");
            })
            .log("Order ${body[order_id]} assigned to CENTRAL (WH-CHI-01)");

        from("direct:fulfillment-center-west")
            .routeId("fulfillment-center-west")
            .log("WEST fulfillment center processing order ${body[order_id]}")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                body.put("fulfillment_center", "WEST");
                body.put("warehouse_code", "WH-LAX-01");
            })
            .log("Order ${body[order_id]} assigned to WEST (WH-LAX-01)");
    }
}
