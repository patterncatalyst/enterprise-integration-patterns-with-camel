package com.example.eip.aimcp;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

/**
 * Registers the order-status lookup as an LLM tool.
 *
 * <p>The {@code ai-tool} component is framework-neutral: the route is published
 * into the shared {@code AiToolRegistry}, and any producer that filters on the
 * {@code shipping} tag can call it — the LangChain4j agent here, and the
 * embedded MCP server for external MCP clients.
 *
 * <p>{@code orderId} is declared as a typed input parameter, so the model is
 * told what to supply and Camel hands it over as an exchange header rather than
 * leaving the route to parse it back out of free text.
 */
@Component
public class OrderLookupToolRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        from("ai-tool:order-status"
                + "?tags=shipping"
                + "&description=Look up the status of a shipping order by order ID"
                + "&parameter.orderId=string"
                + "&parameter.orderId.description=The order identifier, for example ORD-001"
                + "&parameter.orderId.required=true"
                + "&readOnlyHint=true")
            .routeId("order-lookup-tool")
            .log("Tool call — looking up order: ${header.orderId}")
            .choice()
                .when(simple("${header.orderId} == 'ORD-001'"))
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FASTLINE\",\"eta\":\"2026-07-20\"}"))
                .when(simple("${header.orderId} == 'ORD-002'"))
                    .setBody(constant("{\"orderId\":\"ORD-002\",\"status\":\"PROCESSING\",\"warehouse\":\"West Coast Hub\"}"))
                .when(simple("${header.orderId} == 'ORD-003'"))
                    .setBody(constant("{\"orderId\":\"ORD-003\",\"status\":\"DELIVERED\",\"deliveredAt\":\"2026-07-15\"}"))
                .otherwise()
                    .setBody(constant("{\"error\":\"Order not found\"}"))
            .end()
            .log("Tool response: ${body}");
    }
}
