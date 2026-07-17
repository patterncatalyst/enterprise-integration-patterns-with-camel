package com.example.eip.otel;

import java.util.Map;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class MetricsRoute extends RouteBuilder {

    @Override
    public void configure() {
        from("kafka:eip.orders.placed?brokers={{kafka.brokers}}&groupId=otel-metrics")
            .routeId("metrics-order-counter")
            .unmarshal().json(Map.class)
            .log("Metering order ${body[order_id]} from ${body[country]}")
            .toD("micrometer:counter:eip.orders.counted?tags=country=${body[country]}")
            .to("micrometer:timer:eip.orders.processing.time?action=start")
            .process(exchange -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> order = exchange.getIn().getBody(Map.class);
                double amount = ((Number) order.get("amount")).doubleValue();
                order.put("tax", amount * 0.08);
                order.put("total", amount + (amount * 0.08));
                Thread.sleep(20); // simulate processing delay
            })
            .to("micrometer:timer:eip.orders.processing.time?action=stop")
            .log("Metered order ${body[order_id]}: total=${body[total]}");

        rest("/metrics/orders")
            .get()
            .routeId("metrics-orders-rest")
            .to("direct:order-metrics-summary");

        from("direct:order-metrics-summary")
            .routeId("metrics-orders-summary")
            .process(exchange -> {
                var context = exchange.getContext();
                var sb = new StringBuilder("[");
                boolean first = true;
                for (var route : context.getRoutes()) {
                    if (!first) sb.append(",");
                    first = false;
                    var status = context.getRouteController().getRouteStatus(route.getRouteId());
                    sb.append(String.format(
                        "{\"route_id\":\"%s\",\"status\":\"%s\"}",
                        route.getRouteId(), status));
                }
                sb.append("]");
                exchange.getIn().setHeader("Content-Type", "application/json");
                exchange.getIn().setBody(sb.toString());
            });
    }
}
