package com.example.eip.testing.unit;

import java.util.Map;

import jakarta.inject.Inject;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;

import org.apache.camel.CamelContext;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.builder.AdviceWith;
import org.apache.camel.component.mock.MockEndpoint;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import com.example.eip.testing.InventoryService;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@QuarkusTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrderEnrichmentRouteTest {

    @Inject
    CamelContext camelContext;

    @Inject
    ProducerTemplate producer;

    @InjectMock
    InventoryService inventoryService;

    @BeforeAll
    void adviceRoutes() throws Exception {
        AdviceWith.adviceWith(camelContext, "enriched-output-handler", route -> {
            route.weaveAddLast().to("mock:enriched");
        });
    }

    @BeforeEach
    void setup() {
        MockEndpoint.resetMocks(camelContext);

        when(inventoryService.checkStock(any())).thenReturn(Map.of(
            "order_id", 3001,
            "item_sku", "ELEC-TV-55",
            "warehouse", "WAREHOUSE-MOCK",
            "stock_available", 99,
            "weight_kg", 15.0
        ));
    }

    @Test
    void orderIsEnrichedWithInventoryData() throws Exception {
        MockEndpoint mock = camelContext.getEndpoint("mock:enriched", MockEndpoint.class);
        mock.expectedMessageCount(1);

        String order = """
            {"order_id": 3001, "item_sku": "ELEC-TV-55", "amount": 599.99}
            """;
        producer.sendBody("direct:enrich-order", order);

        mock.assertIsSatisfied();

        String body = mock.getReceivedExchanges().get(0).getIn().getBody(String.class);
        assertNotNull(body);
        assertTrue(body.contains("WAREHOUSE-MOCK"));
        assertTrue(body.contains("99"));
    }
}
