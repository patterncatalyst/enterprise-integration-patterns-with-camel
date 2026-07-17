package com.example.eip.kafka.consumer;

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class StaticMembershipConsumerRoute extends RouteBuilder {

    @Override
    public void configure() {
        String instanceId = "instance-" + ProcessHandle.current().pid();

        from("kafka:eip.orders.static?brokers={{kafka.brokers}}"
                + "&groupId=static-consumer"
                + "&groupInstanceId=" + instanceId
                + "&sessionTimeoutMs=45000"
                + "&maxPollRecords=100"
                + "&autoCommitEnable=true")
            .routeId("static-membership-consumer")
            .log("Static member [" + instanceId + "] received: "
                + "partition=${header[kafka.PARTITION]} offset=${header[kafka.OFFSET]}")
            .unmarshal().json(java.util.Map.class)
            .log("Processing order ${body[order_id]} — static membership (no rebalance on restart)");

        from("timer:static-order-gen?period=5000")
            .routeId("static-order-generator")
            .process(exchange -> {
                long orderId = 7000 + (System.nanoTime() % 100);
                exchange.getIn().setBody(String.format(
                    "{\"order_id\": %d, \"customer_id\": \"C-%03d\", \"amount\": %.2f, \"status\": \"placed\"}",
                    orderId, orderId % 40, 19.99 * (1 + orderId % 5)));
            })
            .to("kafka:eip.orders.static?brokers={{kafka.brokers}}");
    }
}
