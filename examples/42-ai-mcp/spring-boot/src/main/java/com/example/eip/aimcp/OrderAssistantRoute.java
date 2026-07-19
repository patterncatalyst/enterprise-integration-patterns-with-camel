package com.example.eip.aimcp;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class OrderAssistantRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        rest("/api/assistant")
            .post("/chat")
            .consumes("application/json")
            .produces("application/json")
            .to("direct:assistant-chat");

        from("direct:assistant-chat")
            .routeId("assistant-chat")
            .log("Assistant query: ${body}")
            .setHeader("CamelLangChain4jChatPrompt", simple(
                "You are a helpful shipping order assistant. You can look up order statuses "
                + "using the available tools. Be concise and helpful. User query: ${body}"))
            .to("langchain4j-chat:assistant?toolTags=shipping")
            .log("Assistant response: ${body}");
    }
}
