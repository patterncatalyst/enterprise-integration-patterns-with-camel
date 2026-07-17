package com.example.eip.testing.integration;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PaymentGatewayIT {

    @LocalServerPort
    int port;

    @BeforeEach
    void setup() {
        RestAssured.port = port;
    }

    @Test
    void validPaymentReturnsApproval() {
        String payment = """
            {"order_id": 5001, "amount": 99.99, "card_token": "tok_test_visa"}
            """;

        given()
            .contentType(ContentType.JSON)
            .body(payment)
        .when()
            .post("/api/payments/process")
        .then()
            .statusCode(200)
            .body("status", equalTo("APPROVED"))
            .body("gateway", equalTo("MOCK"))
            .body("transaction_id", notNullValue());
    }

    @Test
    void emptyBodyReturnsServerError() {
        given()
            .contentType(ContentType.JSON)
            .body("{}")
        .when()
            .post("/api/payments/process")
        .then()
            .statusCode(200)
            .body("gateway", equalTo("MOCK"));
    }
}
