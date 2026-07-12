package com.example.eip.testing.integration;

import jakarta.inject.Inject;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.builder.AdviceWith;
import org.apache.camel.component.mock.MockEndpoint;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
@TestProfile(IntegrationTestProfile.class)
class KafkaIntegrationTest {

    @Inject
    CamelContext camelContext;

    @Inject
    ProducerTemplate producer;

    @Test
    void kafkaFilterRouteCanBeTestedWithDirectReplacement() throws Exception {
        AdviceWith.adviceWith(camelContext, "kafka-order-filter", route -> {
            route.replaceFromWith("direct:kafka-test-input");
        });
        AdviceWith.adviceWith(camelContext, "high-value-handler", route -> {
            route.weaveAddLast().to("mock:kafka-high-value");
        });

        MockEndpoint mock = camelContext.getEndpoint("mock:kafka-high-value", MockEndpoint.class);
        mock.reset();
        mock.expectedMessageCount(1);

        String order = """
            {"order_id": 6001, "amount": 500.00, "customer_id": "C-200"}
            """;
        producer.sendBody("direct:filter-order", order);

        mock.assertIsSatisfied();

        String body = mock.getReceivedExchanges().get(0).getIn().getBody(String.class);
        assertTrue(body.toString().contains("6001"));
    }
}
