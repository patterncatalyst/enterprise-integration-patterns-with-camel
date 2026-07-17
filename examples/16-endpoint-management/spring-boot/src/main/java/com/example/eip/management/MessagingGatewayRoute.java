package com.example.eip.management;

import org.apache.camel.FluentProducerTemplate;
import org.apache.camel.builder.RouteBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Messaging Gateway pattern — wraps Camel's FluentProducerTemplate behind a
 * domain-specific interface so application code never touches messaging APIs
 * directly.
 */
@Component
public class MessagingGatewayRoute extends RouteBuilder {

    @Override
    public void configure() {
        // Gateway entry point: publish an order-placed event
        from("direct:gateway-publish-order")
            .routeId("gateway-publish-order")
            .log("Gateway → publishing order to eip.orders.placed")
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}");

        // Gateway entry point: request an inventory check (fire-and-forget to a direct route)
        from("direct:gateway-request-inventory")
            .routeId("gateway-request-inventory")
            .log("Gateway → requesting inventory check")
            .to("kafka:eip.orders.inventory-request?brokers={{kafka.brokers}}");

        // Timer that exercises the gateway every 8 seconds
        from("timer:gateway-demo?period=8000&delay=5000")
            .routeId("gateway-demo-timer")
            .bean("orderMessagingGateway", "publishSampleOrder");
    }

    /**
     * The gateway bean itself — application code calls these methods instead of
     * dealing with Camel endpoints directly.
     */
    @Component("orderMessagingGateway")
    public static class OrderMessagingGateway {

        private static final Logger LOG = LoggerFactory.getLogger(OrderMessagingGateway.class);

        private final FluentProducerTemplate producer;

        private long counter = 0;

        public OrderMessagingGateway(FluentProducerTemplate producer) {
            this.producer = producer;
        }

        /** Publish an order-placed event through the messaging gateway. */
        public void publishOrderPlaced(String orderJson) {
            LOG.info("OrderMessagingGateway.publishOrderPlaced invoked");
            producer.to("direct:gateway-publish-order")
                    .withBody(orderJson)
                    .send();
        }

        /** Request an inventory check through the messaging gateway. */
        public void requestInventoryCheck(String orderJson) {
            LOG.info("OrderMessagingGateway.requestInventoryCheck invoked");
            producer.to("direct:gateway-request-inventory")
                    .withBody(orderJson)
                    .send();
        }

        /** Called by the demo timer to exercise the gateway. */
        public void publishSampleOrder() {
            counter++;
            String json = """
                {
                    "order_id": %d,
                    "customer_id": "CUST-GW-%03d",
                    "item_sku": "SKU-GATEWAY-%d",
                    "quantity": 1,
                    "amount": 99.99,
                    "destination_country": "US",
                    "contains_hazmat": false,
                    "shipping_priority": "STANDARD",
                    "timestamp": %d
                }
                """.formatted(10000 + counter, counter, counter, System.currentTimeMillis());

            LOG.info("Gateway demo — publishing sample order {}", 10000 + counter);
            publishOrderPlaced(json);
        }
    }
}
