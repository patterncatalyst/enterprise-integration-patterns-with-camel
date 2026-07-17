package com.example.eip.observability;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class ControlBusRoute extends RouteBuilder {

    @Override
    public void configure() {
        restConfiguration().host("0.0.0.0");

        rest("/control")
            .get("/status/{routeId}")
                .to("direct:route-status")
            .post("/stop/{routeId}")
                .to("direct:route-stop")
            .post("/start/{routeId}")
                .to("direct:route-start");

        from("direct:route-status")
            .routeId("control-bus-status")
            .toD("controlbus:route?routeId=${header.routeId}&action=status")
            .log("Route ${header.routeId} status: ${body}");

        from("direct:route-stop")
            .routeId("control-bus-stop")
            .log("Stopping route: ${header.routeId}")
            .toD("controlbus:route?routeId=${header.routeId}&action=stop");

        from("direct:route-start")
            .routeId("control-bus-start")
            .log("Starting route: ${header.routeId}")
            .toD("controlbus:route?routeId=${header.routeId}&action=start");
    }
}
