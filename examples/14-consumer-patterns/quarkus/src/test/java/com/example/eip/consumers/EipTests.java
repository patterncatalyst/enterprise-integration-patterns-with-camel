package com.example.eip.consumers;

import javax.sql.DataSource;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.citrusframework.TestCaseRunner;
import org.citrusframework.annotations.CitrusResource;
import org.citrusframework.camel.dsl.CamelSupport;
import org.citrusframework.kafka.message.KafkaMessageHeaders;
import org.citrusframework.quarkus.CitrusSupport;
import org.citrusframework.spi.BindToRegistry;
import org.citrusframework.spi.Resources;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@QuarkusTest
@CitrusSupport
class EipTests implements EipTestSupport {

    @CitrusResource
    TestCaseRunner t;

    @Inject
    @BindToRegistry
    DataSource dataSource;

    @Inject
    @BindToRegistry
    CamelContext camelContext;

    @Nested
    class EventDrivenConsumerTest {

        @Test
        public void shouldConsumeEventFromKafka() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_placed")
                    .variable("amount", 150)
            );

            t.given(waitForCamelRouteStarted("event-driven-consumer", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.events")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("event-driven-consumer", 1, camelContext));
        }
    }

    @Nested
    class CompetingConsumersTest {

        @Test
        public void shouldProcessWithCompetingConsumers() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_placed")
                    .variable("amount", 200)
            );

            t.given(waitForCamelRouteStarted("competing-consumers", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.compete")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("competing-consumers", 1, camelContext));
        }
    }

    @Nested
    class PollingConsumerTest {

        @Test
        public void shouldPollMessageFromKafka() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_placed")
                    .variable("amount", 99)
            );

            t.given(waitForCamelRouteStarted("polling-consumer", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.poll")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            // Wait for the timer-based poll cycle to pick up the message
            t.then(verifyRouteStats("polling-consumer", """
                    { "exchangesCompleted": "@greaterThan(1)@" }
                """, camelContext));
        }
    }

    @Nested
    class MessageDispatcherTest {

        @Test
        public void shouldDispatchOrderPlacedEvent() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_placed")
                    .variable("amount", 120)
            );

            t.given(waitForCamelRouteStarted("message-dispatcher", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.dispatch")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("handle-order-placed", 1, camelContext));
        }

        @Test
        public void shouldDispatchOrderCancelledEvent() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_cancelled")
                    .variable("amount", 80)
            );

            t.given(waitForCamelRouteStarted("message-dispatcher", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.dispatch")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("handle-order-cancelled", 1, camelContext));
        }

        @Test
        public void shouldDispatchOrderRefundedEvent() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_refunded")
                    .variable("amount", 55)
            );

            t.given(waitForCamelRouteStarted("message-dispatcher", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.dispatch")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("handle-order-refunded", 1, camelContext));
        }

        @Test
        public void shouldSkipUnknownEventType() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_unknown")
                    .variable("amount", 40)
            );

            t.given(waitForCamelRouteStarted("message-dispatcher", camelContext));

            t.when(
                send()
                    .endpoint("kafka:eip.consumer.dispatch")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "${id}")
            );

            t.then(verifyCompletedExchanges("handle-order-unknown", 1, camelContext));
        }
    }

    @Nested
    class SqlPollingConsumerTest {

        @Test
        public void shouldHandleSqlPollingConsumer() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("amount", 40)
            );

            t.given(waitForCamelRouteStarted("polling-consumer-sql", camelContext));

            t.when(
                sql(dataSource)
                    .statement("INSERT INTO orders.orders (customer_id, item_sku, quantity, amount) VALUES ('CUST-00${id}', 'SKU-${id}', '1', '${amount}')")
            );

            t.then(
                repeatOnError()
                    .times(15)
                    .actions(
                        receive()
                            .endpoint("kafka:eip.orders.placed?consumerGroup=citrus-placed-group")
                            .message()
                            .body("""
                            {
                              "id": "@variable(order_id)@",
                              "customer_id": "CUST-00${id}",
                              "status": "PLACED",
                              "amount": ${amount}.0,
                              "item_sku": "SKU-${id}",
                              "quantity": 1,
                              "created_at": "@ignore@"
                            }
                            """)
                    )
            );

            // The poller marks the row PROCESSING after the exchange that
            // published it completes, so the update can land just after the
            // Kafka record is received: poll for it instead of reading once.
            t.then(
                repeatOnError()
                    .times(10)
                    .actions(
                        sql(dataSource)
                            .query()
                            .statement("SELECT status FROM orders.orders WHERE id = '${order_id}'")
                            .validate("status", "PROCESSING")
                    )
            );

        }
    }

    @Nested
    class PulsarEventDrivenConsumerTest {

        @Test
        public void shouldConsumeEventFromPulsar() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("eventType", "order_placed")
                    .variable("amount", 175)
            );

            t.given(waitForCamelRouteStarted("event-driven-consumer-pulsar", camelContext));

            t.when(
                camel()
                    .send()
                    .endpoint(CamelSupport.camel().endpoints()
                            .pulsar("persistent://public/default/eip.consumer.events")
                            .serviceUrl("pulsar://localhost:6650")
                            .producerName("citrus-consumer-test")::getRawUri)
                    .message()
                    .body(Resources.create("templates/order.json"))
            );

            t.then(verifyCompletedExchanges("event-driven-consumer-pulsar", 1, camelContext));
        }
    }
}
