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
class OrderValidationRouteTest {

    @Autowired
    CamelContext camelContext;

    @Autowired
    ProducerTemplate producer;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "kafka-order-filter", route -> {
            route.replaceFromWith("direct:test-kafka-stub");
        });
        AdviceWith.adviceWith(camelContext, "domestic-handler", route -> {
            route.weaveAddLast().to("mock:domestic");
        });
        AdviceWith.adviceWith(camelContext, "international-handler", route -> {
            route.weaveAddLast().to("mock:international");
        });
        AdviceWith.adviceWith(camelContext, "hazmat-handler", route -> {
            route.weaveAddLast().to("mock:hazmat");
        });
        camelContext.start();
    }

    @BeforeEach
    void resetMocks() {
        MockEndpoint.resetMocks(camelContext);
    }

    @Test
    void domesticOrderRoutesToDomestic() throws Exception {
        MockEndpoint domestic = camelContext.getEndpoint("mock:domestic", MockEndpoint.class);
        MockEndpoint international = camelContext.getEndpoint("mock:international", MockEndpoint.class);
        MockEndpoint hazmat = camelContext.getEndpoint("mock:hazmat", MockEndpoint.class);

        domestic.expectedMessageCount(1);
        international.expectedMessageCount(0);
        hazmat.expectedMessageCount(0);

        String order = """
            {"order_id": 1001, "country": "US", "shipping_type": "STANDARD", "amount": 59.99}
            """;
        producer.sendBody("direct:validate-order", order);

        domestic.assertIsSatisfied();
        international.assertIsSatisfied();
        hazmat.assertIsSatisfied();
    }

    @Test
    void internationalOrderRoutesToInternational() throws Exception {
        MockEndpoint domestic = camelContext.getEndpoint("mock:domestic", MockEndpoint.class);
        MockEndpoint international = camelContext.getEndpoint("mock:international", MockEndpoint.class);

        domestic.expectedMessageCount(0);
        international.expectedMessageCount(1);

        String order = """
            {"order_id": 1002, "country": "DE", "shipping_type": "EXPRESS", "amount": 149.99}
            """;
        producer.sendBody("direct:validate-order", order);

        domestic.assertIsSatisfied();
        international.assertIsSatisfied();
    }

    @Test
    void hazmatOrderRoutesToHazmat() throws Exception {
        MockEndpoint hazmat = camelContext.getEndpoint("mock:hazmat", MockEndpoint.class);
        MockEndpoint domestic = camelContext.getEndpoint("mock:domestic", MockEndpoint.class);

        hazmat.expectedMessageCount(1);
        domestic.expectedMessageCount(0);

        String order = """
            {"order_id": 1003, "country": "US", "shipping_type": "HAZMAT", "amount": 299.99}
            """;
        producer.sendBody("direct:validate-order", order);

        hazmat.assertIsSatisfied();
        domestic.assertIsSatisfied();
    }
}
