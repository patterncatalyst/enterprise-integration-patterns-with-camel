package com.example.eip.flags;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.citrusframework.TestCaseRunner;
import org.citrusframework.annotations.CitrusResource;
import org.citrusframework.kafka.message.KafkaMessageHeaders;
import org.citrusframework.quarkus.CitrusSupport;
import org.citrusframework.spi.BindToRegistry;
import org.citrusframework.spi.Resources;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.ClassOrderer;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestClassOrder;
import org.junit.jupiter.api.TestMethodOrder;

@QuarkusTest
@CitrusSupport
@TestClassOrder(ClassOrderer.OrderAnnotation.class)
class EipTests implements EipTestSupport {

    @CitrusResource
    TestCaseRunner t;

    @Inject
    @BindToRegistry
    CamelContext camelContext;

    @Nested
    @Order(1)
    class FeatureFlagDetourTest {

        @Test
        public void shouldEnrichOrderWhenFlagEnabled() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("tier", "STANDARD")
                    .variable("amount", 150)
            );

            t.given(waitForCamelRouteStarted("feature-flag-detour", camelContext));
            t.given(resetRouteStats(camelContext,
                    "feature-flag-detour", "enrich-order", "skip-enrichment", "process-order"));

            t.when(
                send()
                    .endpoint("kafka:eip.orders.placed")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "DETOUR-${id}")
            );

            t.then(verifyCompletedExchanges("feature-flag-detour", 1, camelContext));
            t.then(verifyCompletedExchanges("enrich-order", 1, camelContext));
            t.then(verifyCompletedExchanges("process-order", 1, camelContext));
        }
    }

    @Nested
    @Order(2)
    class FeatureFlagAbTestTest {

        @Test
        public void shouldRouteOrderViaFractionalFlag() {
            t.given(
                createVariables()
                    .variable("tier", "STANDARD")
                    .variable("amount", 200)
            );

            t.given(waitForCamelRouteStarted("feature-flag-ab-test", camelContext));
            t.given(resetRouteStats(camelContext,
                    "feature-flag-ab-test", "algorithm-content-based-router", "algorithm-dynamic-router"));

            t.when(
                iterate()
                    .times(10)
                    .actions(
                        createVariables()
                                // Fixed keys, not random ones: flagd's fractional split is a
                                // deterministic hash of flag key + targetingKey (the order id).
                                // For ids 1..10 at 90/10 exactly one (id 8) lands on "new";
                                // ten random ids missed it about a third of the time.
                                .variable("id", "${i}"),
                        send()
                            .endpoint("kafka:eip.orders.placed")
                            .message()
                            .body(Resources.create("templates/order.json"))
                            .header(KafkaMessageHeaders.MESSAGE_KEY, "AB-${id}")
                    )
            );

            t.then(verifyCompletedExchanges("feature-flag-ab-test", 10, camelContext));
            t.then(verifyRouteStats("algorithm-content-based-router", """
            { "exchangesCompleted": "@variable(algorithm-legacy-count)@" }
            """, camelContext));
            t.then(verifyRouteStats("algorithm-dynamic-router", """
            { "exchangesCompleted": "@variable(algorithm-new-count)@" }
            """, camelContext));

            t.then(context -> {
                int algorithmLegacyCount = context.getVariable("algorithm-legacy-count", Integer.class);
                int algorithmNewCount = context.getVariable("algorithm-new-count", Integer.class);

                Assertions.assertEquals(9, algorithmLegacyCount, "ids 1..10 except 8 bucket to legacy");
                Assertions.assertEquals(1, algorithmNewCount, "id 8 buckets to new");
            });
        }
    }

    @Nested
    @Order(3)
    @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
    class FeatureFlagTargetedTest {

        @Test
        @Order(1)
        public void shouldRouteStandardTierToHazmatV1() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("tier", "STANDARD")
                    .variable("amount", 100)
            );

            t.given(waitForCamelRouteStarted("feature-flag-targeted", camelContext));
            t.given(resetRouteStats(camelContext,
                    "feature-flag-targeted", "eip-orders-hazmat-v1", "eip-orders-hazmat-v2"));

            t.when(
                send()
                    .endpoint("kafka:eip.orders.placed")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "TARGETED-STD-${id}")
            );

            t.then(verifyCompletedExchanges("feature-flag-targeted", 1, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v1", 1, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v2", 0, camelContext));
        }

        @Test
        @Order(2)
        public void shouldRouteEnterpriseTierToHazmatV2() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("tier", "ENTERPRISE")
                    .variable("amount", 500)
            );

            t.given(resetRouteStats(camelContext,
                    "feature-flag-targeted", "eip-orders-hazmat-v1", "eip-orders-hazmat-v2"));

            t.when(
                send()
                    .endpoint("kafka:eip.orders.placed")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "TARGETED-ENT-${id}")
            );

            t.then(verifyCompletedExchanges("feature-flag-targeted", 1, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v1", 0, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v2", 1, camelContext));
        }

        @Test
        @Order(3)
        public void shouldRouteVipTierToHazmatV2() {
            t.given(
                createVariables()
                    .variable("id", "citrus:randomNumber(4)")
                    .variable("tier", "VIP")
                    .variable("amount", 250)
            );

            t.given(resetRouteStats(camelContext,
                    "feature-flag-targeted", "eip-orders-hazmat-v1", "eip-orders-hazmat-v2"));

            t.when(
                send()
                    .endpoint("kafka:eip.orders.placed")
                    .message()
                    .body(Resources.create("templates/order.json"))
                    .header(KafkaMessageHeaders.MESSAGE_KEY, "TARGETED-VIP-${id}")
            );

            t.then(verifyCompletedExchanges("feature-flag-targeted", 1, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v1", 0, camelContext));
            t.then(verifyCompletedExchanges("eip-orders-hazmat-v2", 1, camelContext));
        }
    }
}
