package com.example.eip.otel;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class HealthProbeRoute extends RouteBuilder {

    @Override
    public void configure() {
        rest("/health/routes")
            .get()
            .routeId("health-routes-rest")
            .to("direct:health-probe");

        from("direct:health-probe")
            .routeId("health-probe-handler")
            .process(exchange -> {
                var context = exchange.getContext();
                var sb = new StringBuilder("[");
                boolean first = true;
                for (var route : context.getRoutes()) {
                    if (!first) sb.append(",");
                    first = false;
                    var status = context.getRouteController()
                        .getRouteStatus(route.getRouteId());
                    sb.append(String.format(
                        "{\"route_id\":\"%s\",\"status\":\"%s\"}",
                        route.getRouteId(),
                        status != null ? status.name() : "Unknown"));
                }
                sb.append("]");
                exchange.getIn().setHeader("Content-Type", "application/json");
                exchange.getIn().setBody(sb.toString());
            });
    }
}
