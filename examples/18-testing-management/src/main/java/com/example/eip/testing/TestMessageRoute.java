package com.example.eip.testing;

import java.util.concurrent.atomic.AtomicLong;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * Test Message pattern — injects synthetic test orders into the production
 * pipeline at regular intervals. Test messages carry a negative order_id and a
 * {@code test_message=true} header so downstream routes can identify and
 * filter them out before real processing.  A dedicated verifier route
 * checks processed output and logs pass/fail results.
 */
@ApplicationScoped
public class TestMessageRoute extends RouteBuilder {

    private final AtomicLong counter = new AtomicLong();

    @Override
    public void configure() {
        // --- Inject synthetic test orders every 30 seconds ---
        from("timer:test-message-injector?period=30000&delay=10000")
            .routeId("test-message-injector")
            .process(exchange -> {
                long id = counter.incrementAndGet();
                long testId = -1 * id;   // negative IDs mark test messages
                double expectedAmount = 99.99;

                String json = """
                    {
                        "order_id": %d,
                        "customer_id": "TEST-ROBOT",
                        "item_sku": "SKU-TEST-001",
                        "quantity": 1,
                        "amount": %.2f,
                        "status": "PENDING",
                        "requires_enrichment": false,
                        "payment_method": "TEST"
                    }
                    """.formatted(testId, expectedAmount);

                exchange.getIn().setBody(json);
                exchange.getIn().setHeader("test_message", true);
                exchange.getIn().setHeader("kafka.KEY", String.valueOf(testId));
            })
            .log("TEST-MESSAGE: injecting test order ${header.kafka.KEY}")
            .to("kafka:eip.orders.placed?brokers={{kafka.brokers}}");

        // --- Business processing route — filters out test messages ---
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=test-msg-processor")
            .routeId("test-message-business-processor")
            .unmarshal().json()
            .choice()
                .when(header("test_message").isEqualTo("true"))
                    .log("TEST-MESSAGE: detected test order ${body[order_id]} — routing to verifier")
                    .marshal().json()
                    .to("direct:test-message-verifier")
                .otherwise()
                    .log("Processing real order ${body[order_id]}")
                    .marshal().json()
                    .to("kafka:eip.orders.processed?brokers={{kafka.brokers}}")
            .end();

        // --- Verifier route — checks test messages and logs pass/fail ---
        from("direct:test-message-verifier")
            .routeId("test-message-verifier")
            .unmarshal().json()
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                var body = exchange.getIn().getBody(java.util.Map.class);
                Number orderId = (Number) body.get("order_id");
                Number amount  = (Number) body.get("amount");
                String customer = (String) body.get("customer_id");

                boolean idNegative = orderId != null && orderId.longValue() < 0;
                boolean amountCorrect = amount != null
                        && Math.abs(amount.doubleValue() - 99.99) < 0.01;
                boolean customerCorrect = "TEST-ROBOT".equals(customer);
                boolean pass = idNegative && amountCorrect && customerCorrect;

                exchange.getIn().setHeader("test_result", pass ? "PASS" : "FAIL");
                exchange.getIn().setHeader("test_order_id", orderId);
            })
            .log("TEST-VERIFY: order ${header.test_order_id} => ${header.test_result}")
            .choice()
                .when(header("test_result").isEqualTo("FAIL"))
                    .log("TEST-VERIFY: FAILURE — test message did not match expectations")
                    .marshal().json()
                    .to("kafka:eip.test.failures?brokers={{kafka.brokers}}")
            .end();
    }
}
