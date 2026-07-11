package com.example.eip.infra;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Channel Adapter pattern — connects non-messaging systems to the
 * messaging infrastructure.
 *
 * Inbound adapter: a REST endpoint accepts orders from external HTTP
 * clients and publishes them into the Kafka messaging channel.
 *
 * Outbound adapter: a Kafka consumer reads processed orders and
 * "sends" them to an external system (simulated with a log).
 */
@ApplicationScoped
public class ChannelAdapterRoute extends RouteBuilder {

    @Override
    public void configure() {
        // --- Inbound Channel Adapter (REST -> Kafka) ---
        rest("/api/orders")
            .post()
                .consumes("application/json")
                .produces("application/json")
                .to("direct:inbound-adapter");

        from("direct:inbound-adapter")
            .routeId("channel-adapter-inbound")
            .log("Inbound Channel Adapter — received order via REST: ${body}")
            .to("kafka:eip.orders.incoming?brokers={{kafka.brokers}}")
            .setBody(constant("{\"status\": \"accepted\"}"));

        // --- Outbound Channel Adapter (Kafka -> external system) ---
        from("kafka:eip.orders.fulfilled?brokers={{kafka.brokers}}&groupId=outbound-adapter")
            .routeId("channel-adapter-outbound")
            .log("Outbound Channel Adapter — dispatching to external shipping API: ${body}")
            .log("  -> POST https://shipping.example.com/dispatch  (simulated)")
            .log("  -> Order dispatched successfully");
    }
}
