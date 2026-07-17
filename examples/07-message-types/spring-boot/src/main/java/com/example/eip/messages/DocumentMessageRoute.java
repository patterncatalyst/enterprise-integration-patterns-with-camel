package com.example.eip.messages;

import org.springframework.stereotype.Component;
import org.apache.camel.builder.RouteBuilder;

/**
 * Document Message pattern — a message whose body carries a complete
 * data record with no implied action.
 *
 * Full order documents are published to {@code eip.documents.orders}.
 * The consumer receives the document and logs its contents.  Unlike a
 * Command Message, the receiver decides what to do with the data.
 */
@Component
public class DocumentMessageRoute extends RouteBuilder {

    @Override
    public void configure() {
        // ── Producer: accept document from direct endpoint, publish to Kafka ──
        from("direct:send-document")
            .routeId("document-message-producer")
            .log("Sending document → eip.documents.orders: order ${header.kafka.KEY}")
            .to("kafka:eip.documents.orders?brokers={{kafka.brokers}}");

        // ── Consumer: receive and inspect the document ───────────────────────
        from("kafka:eip.documents.orders?brokers={{kafka.brokers}}&groupId=document-consumer")
            .routeId("document-message-consumer")
            .unmarshal().json()
            .log("Received order document: order_id=${body[order_id]}, "
                + "customer=${body[customer_id]}, "
                + "total=${body[total_amount]}, "
                + "status=${body[status]}")
            .log("Full document payload: ${body}");
    }
}
