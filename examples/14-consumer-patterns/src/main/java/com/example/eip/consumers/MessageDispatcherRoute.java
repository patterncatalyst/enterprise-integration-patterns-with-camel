package com.example.eip.consumers;

import java.util.Set;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Message Dispatcher — a single consumer reads from Kafka and dispatches
 * each message to a specialised handler route based on the {@code event_type}
 * field.  A validation check ensures only known event types are dispatched;
 * unknown types are logged and dropped.
 */
@ApplicationScoped
public class MessageDispatcherRoute extends RouteBuilder {

    private static final Set<String> ALLOWED_EVENT_TYPES = Set.of(
        "order_placed", "order_cancelled", "order_refunded"
    );

    @Override
    public void configure() {
        // --- dispatcher ---
        from("kafka:eip.consumer.dispatch?brokers={{kafka.brokers}}"
                + "&groupId=message-dispatcher&autoOffsetReset=earliest")
            .routeId("message-dispatcher")
            .unmarshal().json()
            .log("Dispatcher received: order ${body[order_id]}, type=${body[event_type]}")
            .choice()
                .when(exchange -> {
                    var body = exchange.getIn().getBody(java.util.Map.class);
                    String eventType = (String) body.get("event_type");
                    return eventType != null && ALLOWED_EVENT_TYPES.contains(eventType);
                })
                    .toD("direct:handle-${body[event_type]}")
                .otherwise()
                    .log("Unknown event_type '${body[event_type]}' — skipping")
            .end();

        // --- handler: order_placed ---
        from("direct:handle-order_placed")
            .routeId("handle-order-placed")
            .log("Handling ORDER PLACED: order ${body[order_id]}, "
                + "amount=${body[amount]}, sku=${body[item_sku]}");

        // --- handler: order_cancelled ---
        from("direct:handle-order_cancelled")
            .routeId("handle-order-cancelled")
            .log("Handling ORDER CANCELLED: order ${body[order_id]}, "
                + "refund pending for amount=${body[amount]}");

        // --- handler: order_refunded ---
        from("direct:handle-order_refunded")
            .routeId("handle-order-refunded")
            .log("Handling ORDER REFUNDED: order ${body[order_id]}, "
                + "amount=${body[amount]} returned to customer ${body[customer_id]}");
    }
}
