package com.example.eip.testing.integration;

import java.util.Map;

import io.quarkus.test.junit.QuarkusTestProfile;

public class IntegrationTestProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of(
            "payment.gateway.mode", "mock",
            "quarkus.kafka.devservices.enabled", "false",
            "quarkus.http.test-port", "0"
        );
    }

    @Override
    public String getConfigProfile() {
        return "integration-test";
    }
}
