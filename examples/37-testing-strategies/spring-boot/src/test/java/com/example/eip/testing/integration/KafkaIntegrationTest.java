package com.example.eip.testing.integration;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.builder.AdviceWith;
import org.apache.camel.component.mock.MockEndpoint;
import org.apache.camel.test.spring.junit5.CamelSpringBootTest;
import org.apache.camel.test.spring.junit5.UseAdviceWith;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@CamelSpringBootTest
@UseAdviceWith
@ActiveProfiles("test")
class KafkaIntegrationTest {

    @Autowired
    CamelContext camelContext;

    @Autowired
    ProducerTemplate producer;

    @Test
    void kafkaFilterRouteCanBeTestedWithDirectReplacement() throws Exception {
        AdviceWith.adviceWith(camelContext, "kafka-order-filter", route -> {
            route.replaceFromWith("direct:kafka-test-input");
        });
        AdviceWith.adviceWith(camelContext, "high-value-handler", route -> {
            route.weaveAddLast().to("mock:kafka-high-value");
        });
        camelContext.start();

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
