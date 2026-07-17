package com.example.eip.testing.unit;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.builder.AdviceWith;
import org.apache.camel.component.mock.MockEndpoint;
import org.apache.camel.test.spring.junit5.CamelSpringBootTest;
import org.apache.camel.test.spring.junit5.UseAdviceWith;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@CamelSpringBootTest
@UseAdviceWith
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderFilterRouteTest {

    @Autowired
    CamelContext camelContext;

    @Autowired
    ProducerTemplate producer;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "kafka-order-filter", route -> {
            route.replaceFromWith("direct:test-kafka-input");
        });
        AdviceWith.adviceWith(camelContext, "high-value-handler", route -> {
            route.weaveAddLast().to("mock:high-value");
        });
        camelContext.start();
    }

    @BeforeEach
    void resetMocks() {
        MockEndpoint.resetMocks(camelContext);
    }

    @Test
    void highValueOrderPassesFilter() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:high-value", MockEndpoint.class);
        mock.expectedMessageCount(1);

        String order = """
            {"order_id": 2001, "amount": 250.00, "customer_id": "C-100"}
            """;
        producer.sendBody("direct:filter-order", order);

        mock.assertIsSatisfied();
    }

    @Test
    void lowValueOrderIsFiltered() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:high-value", MockEndpoint.class);
        mock.expectedMessageCount(0);

        String order = """
            {"order_id": 2002, "amount": 49.99, "customer_id": "C-101"}
            """;
        producer.sendBody("direct:filter-order", order);

        mock.assertIsSatisfied();
    }

    @Test
    void borderlineOrderPassesFilter() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:high-value", MockEndpoint.class);
        mock.expectedMessageCount(1);

        String order = """
            {"order_id": 2003, "amount": 100.00, "customer_id": "C-102"}
            """;
        producer.sendBody("direct:filter-order", order);

        mock.assertIsSatisfied();
    }
}
