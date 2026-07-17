package com.example.eip.routing;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class RecipientListRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.shipped?brokers={{kafka.brokers}}&groupId=recipient-list-demo")
            .routeId("notification-recipient-list")
            .unmarshal().json()
            .log("Order ${body[order_id]} shipped — notifying customer")
            .process(exchange -> {
                var body = exchange.getIn().getBody(java.util.Map.class);
                var recipients = new java.util.ArrayList<String>();
                recipients.add("direct:notify-email");
                if (body.containsKey("phone") && body.get("phone") != null) {
                    recipients.add("direct:notify-sms");
                }
                if (((Number) body.getOrDefault("amount", 0)).doubleValue() >= 500) {
                    recipients.add("direct:notify-vip-desk");
                }
                exchange.getIn().setHeader("notificationTargets",
                    String.join(",", recipients));
            })
            .recipientList(header("notificationTargets")).delimiter(",")
            .parallelProcessing();

        from("direct:notify-email")
            .routeId("notify-email")
            .log("EMAIL → Order ${body[order_id]} shipped to ${body[customer_id]}");

        from("direct:notify-sms")
            .routeId("notify-sms")
            .log("SMS → Order ${body[order_id]} shipped, tracking: ${body[tracking_number]}");

        from("direct:notify-vip-desk")
            .routeId("notify-vip-desk")
            .log("VIP DESK → High-value order ${body[order_id]} ($${body[amount]}) shipped");
    }
}
