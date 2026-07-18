package com.example.eip.k8sdeploy;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import io.vertx.mutiny.redis.client.RedisAPI;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class CacheLoaderRoute extends RouteBuilder {

    @Inject
    RedisAPI redis;

    @Override
    public void configure() {
        from("timer:cache-loader?repeatCount=1&delay=5000")
            .routeId("cache-loader")
            .process(exchange -> {
                Map<String, String> customers = Map.of(
                    "C-100", "Acme Shipping Co",
                    "C-101", "Global Freight Ltd",
                    "C-102", "Pacific Cargo Inc",
                    "C-103", "Atlantic Express",
                    "C-104", "Continental Logistics",
                    "C-105", "Harbor Transport"
                );
                customers.forEach((id, name) -> {
                    redis.set(List.of("customer:" + id, name))
                        .await().atMost(Duration.ofSeconds(2));
                });
                exchange.getMessage().setBody(String.valueOf(customers.size()));
            })
            .log("Pre-loaded ${body} customer records into Redis cache");
    }
}
