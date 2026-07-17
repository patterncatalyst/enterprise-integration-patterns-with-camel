package com.example.eip.testing.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Spring Boot equivalent of the Quarkus native integration test.
 * Runs the same PaymentGatewayIT tests against a fully packaged application.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PaymentGatewayNativeIT extends PaymentGatewayIT {
}
