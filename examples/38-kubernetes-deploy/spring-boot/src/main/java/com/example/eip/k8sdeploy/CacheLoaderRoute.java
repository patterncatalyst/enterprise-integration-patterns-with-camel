package com.example.eip.k8sdeploy;

import java.util.Map;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class CacheLoaderRoute extends RouteBuilder {

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Override
    public void configure() {
        from("timer:cache-loader?repeatCount=1&delay=5000")
            .routeId("cache-loader")
            .process(exchange -> {
                Map.of(
                    "C-100", "Acme Shipping Co",
                    "C-101", "Global Freight Ltd",
                    "C-102", "Pacific Cargo Inc",
                    "C-103", "Atlantic Express",
                    "C-104", "Continental Logistics",
                    "C-105", "Harbor Transport"
                ).forEach((id, name) ->
                    redisTemplate.opsForValue().set("customer:" + id, name)
                );
            })
            .log("Pre-loaded 6 customer records into Redis cache");
    }
}
