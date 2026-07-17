package com.example.eip.messages;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;
import org.apache.camel.builder.RouteBuilder;

/**
 * Generates three types of messages on a timer to demonstrate the
 * three fundamental message types:
 *   1. Command Message  — "do something" (ProcessPayment)
 *   2. Document Message  — "here is the data" (full order record)
 *   3. Event Message     — "something happened" (OrderPlaced notification)
 *
 * Each message type is sent to a separate direct endpoint, which the
 * pattern-specific route classes forward to Kafka.
 */
@Component
public class DemoDataGenerator extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        // ── Command Messages ────────────────────────────────────────
        from("timer:generate-commands?period=6000&delay=2000")
            .routeId("generate-command-messages")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                double amount = 25.0 + (id * 17 % 475);

                String json = """
                    {
                        "command": "ProcessPayment",
                        "payment_id": "PAY-%05d",
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "amount": %.2f,
                        "currency": "USD",
                        "payment_method": "%s"
                    }
                    """.formatted(
                        id, id, id % 100, amount,
                        id % 2 == 0 ? "CREDIT_CARD" : "BANK_TRANSFER"
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", "PAY-" + id);
            })
            .to("direct:send-command")
            .log("Generated command message: ProcessPayment PAY-${header.kafka.KEY}");

        // ── Document Messages ───────────────────────────────────────
        from("timer:generate-documents?period=8000&delay=4000")
            .routeId("generate-document-messages")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String[] countries = {"US", "CA", "GB", "DE", "JP"};
                String country = countries[(int) (id % countries.length)];
                double amount = 50 + (id * 37 % 500);

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "CUST-%03d",
                        "items": [
                            { "sku": "SKU-%s-%d", "description": "Widget %s", "quantity": %d, "unit_price": %.2f }
                        ],
                        "shipping_address": {
                            "street": "%d Commerce Blvd",
                            "city": "Metropolis",
                            "country": "%s",
                            "postal_code": "%05d"
                        },
                        "total_amount": %.2f,
                        "status": "PENDING"
                    }
                    """.formatted(
                        id, id % 100,
                        country, id, country.charAt(0) + String.valueOf(id), (int) (1 + id % 5), amount / (1 + id % 5),
                        100 + id, country, (int) (10000 + id % 90000),
                        amount
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("direct:send-document")
            .log("Generated document message: Order ${header.kafka.KEY}");

        // ── Event Messages ──────────────────────────────────────────
        from("timer:generate-events?period=5000&delay=3000")
            .routeId("generate-event-messages")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                String eventId = "evt-" + java.util.UUID.randomUUID().toString().substring(0, 8);
                String timestamp = java.time.Instant.now().toString();

                String json = """
                    {
                        "event_type": "OrderPlaced",
                        "event_id": "%s",
                        "event_time": "%s",
                        "source": "order-service",
                        "data": {
                            "order_id": %d,
                            "customer_id": "CUST-%03d",
                            "item_count": %d,
                            "total_amount": %.2f
                        }
                    }
                    """.formatted(
                        eventId, timestamp,
                        id, id % 100,
                        (int) (1 + id % 8),
                        50.0 + (id * 29 % 450)
                    );
                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(id));
            })
            .to("direct:send-event")
            .log("Generated event message: OrderPlaced for order ${header.kafka.KEY}");
    }
}
