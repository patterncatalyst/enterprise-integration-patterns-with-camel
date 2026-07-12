package com.example.eip.testing.unit;

import jakarta.inject.Inject;

import io.quarkus.test.junit.QuarkusTest;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.builder.AdviceWith;
import org.apache.camel.component.mock.MockEndpoint;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PaymentGatewayUnitTest {

    @Inject
    CamelContext camelContext;

    @Inject
    ProducerTemplate producer;

    @BeforeAll
    void advice() throws Exception {
        AdviceWith.adviceWith(camelContext, "mock-gateway", route -> {
            route.weaveAddLast().to("mock:gateway-output");
        });
    }

    @BeforeEach
    void resetMocks() {
        MockEndpoint.resetMocks(camelContext);
    }

    @Test
    void mockGatewayReturnsApproval() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:gateway-output", MockEndpoint.class);
        mock.expectedMessageCount(1);

        String payment = """
            {"order_id": 4001, "amount": 99.99, "card_token": "tok_test_visa"}
            """;
        String response = producer.requestBody("direct:mock-gateway", payment, String.class);

        mock.assertIsSatisfied();
        assertTrue(response.contains("APPROVED"));
        assertTrue(response.contains("MOCK"));
    }

    @Test
    void productionGatewayReturnsForwarded() throws Exception {
        String payment = """
            {"order_id": 4002, "amount": 199.99, "card_token": "tok_test_mc"}
            """;
        String response = producer.requestBody("direct:production-gateway", payment, String.class);

        assertTrue(response.contains("FORWARDED"));
        assertTrue(response.contains("PRODUCTION"));
    }
}
