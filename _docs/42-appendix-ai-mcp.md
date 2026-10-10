---
title: "Appendix X: AI and MCP with Camel"
order: 42
part: appendices
description: "Integrating AI into Camel routes — the LangChain4j Chat component for classification, ai-tool and LangChain4j Agent for tool calling, the embedded and catalog MCP servers, and Wanaku for exposing Camel routes as AI tools."
duration: "40 minutes"
---

Apache Camel connects to over 350 systems. AI agents need tools to interact with the real world -- databases, APIs, message brokers, file systems, cloud services. LangChain4j bridges these worlds. With Camel's LangChain4j components, Camel routes become AI tools that any LLM agent can call, and AI models become processors that sit inside Camel routes like any other component. A content-based router that once relied on hardcoded rules can now delegate classification to an LLM. A customer support pipeline can use an AI agent that looks up order statuses, checks inventory, and sends notifications -- all through existing Camel routes.

This appendix covers the full AI integration ecosystem for Camel:

- **LangChain4j Chat component** -- send messages to LLMs and receive responses as part of a Camel route
- **Tool calling** -- register Camel routes as tools with `ai-tool`, and call them from a LangChain4j agent
- **MCP integration** -- connect Camel agents to external MCP servers and consume their tools
- **Conversation memory** -- maintain context across multiple turns in a chat session
- **RAG** -- ground AI responses in domain-specific documents
- **Guardrails** -- validate inputs and outputs to prevent misuse and data leakage
- **Multimodal content** -- send images, PDFs, and audio to AI models
- **Embedded MCP Server** -- publish your application's `ai-tool` routes to external MCP clients
- **Camel Catalog MCP Server** -- expose the Camel Catalog as an MCP server for AI coding assistants
- **Wanaku** -- an MCP router that makes existing Camel routes available as AI tools

The code is in `examples/42-ai-mcp/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
cd examples/42-ai-mcp/quarkus && mvn quarkus:dev
```

```bash
cd examples/42-ai-mcp/spring-boot && mvn spring-boot:run
```

Both runtimes require Ollama running locally with the `qwen2.5:3b` model:

```bash
ollama pull qwen2.5:3b
ollama serve
```

Fedora's packaged `ollama` trails upstream by many releases; to run the current release without installing anything, use the pinned container image on the same port:

```bash
docker run -d --name ollama -p 127.0.0.1:11434:11434 -v ollama:/root/.ollama ollama/ollama:0.40.2
docker exec ollama ollama pull qwen2.5:3b
```

> **Pick a model that can call tools.** The examples default to `qwen2.5:3b`
> because tool calling is the whole point of the `ai-tool` sections below, and
> not every small model does it. `llama3.2` was the earlier default and is a
> poor fit: it answers in a single round trip and never invokes the registered
> tools, so `toolExecutions` comes back empty and the assistant makes up an
> answer. `qwen2.5:3b` is a 1.9 GB download and calls tools
> reliably; `llama3.1:8b` and the hosted OpenAI and Azure models below work too.
> The route definitions do not change between them.

{% include excalidraw.html file="42-ai-mcp-architecture" alt="Camel AI/MCP architecture" caption="Figure X.1 — Camel AI integration architecture: routes produce to LangChain4j agents, which call back to Camel route tools and external MCP servers." %}

## The LangChain4j Chat component

The `langchain4j-chat` component is a producer-only component that sends messages to a LangChain4j `ChatModel` and returns the model's response as the exchange body. The URI format is straightforward:

```
langchain4j-chat:chatId[?options]
```

The `chatId` is a logical name that identifies the chat operation -- it does not select the model. The model is configured separately through runtime-specific configuration (Quarkus CDI or Spring Boot auto-configuration). Key options include:

| Option | Default | Description |
|--------|---------|-------------|
| `chatOperation` | `CHAT_SINGLE_MESSAGE` | `CHAT_SINGLE_MESSAGE` sends the message body as the prompt; `CHAT_SINGLE_MESSAGE_WITH_PROMPT` fills a template from the `CamelLangChain4jChatPromptTemplate` header with the variables in a `Map` body |

With the default operation the prompt **is the message body**. Build it with a Simple expression, so exchange data goes straight into it:

```java
.setBody(simple(
    "Classify this order: ${body}"))
.to("langchain4j-chat:classifier")
```

There is no "prompt" header. A header named `CamelLangChain4jChatPrompt` is silently ignored: the model then receives only the original body (here, the bare order JSON) and answers it as small talk, which is easy to mistake for a weak model.

The model's response replaces the exchange body as a plain string.

### OrderClassifierRoute

The classifier route demonstrates the simplest LangChain4j pattern -- a one-shot prompt that takes unstructured order data and returns a structured JSON classification. A REST endpoint receives the order, the prompt instructs the LLM on the expected output format, and the component handles the round-trip to the model.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
package com.example.eip.aimcp;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderClassifierRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        rest("/api/orders")
            .post("/classify")
            .consumes("application/json")
            .produces("application/json")
            .to("direct:classify-order");

        from("direct:classify-order")
            .routeId("classify-order")
            .log("Classifying order: ${body}")
            // CHAT_SINGLE_MESSAGE (the default operation) sends the message
            // body to the model, so the instructions go in the body. There is
            // no "prompt" header: a header here is never seen by the model.
            .setBody(simple(
                "You are an order classification assistant for a shipping company. "
                + "Classify the following order and return a JSON object with these fields: "
                + "category (one of: ELECTRONICS, PERISHABLE, HAZARDOUS, FRAGILE, STANDARD), "
                + "priority (one of: CRITICAL, HIGH, MEDIUM, LOW), "
                + "fulfillmentType (one of: SAME_DAY, NEXT_DAY, STANDARD, ECONOMY). "
                + "Only return the JSON, no other text. Order: ${body}"))
            .to("langchain4j-chat:classifier")
            .log("Classification result: ${body}");
    }
}
```

```java
package com.example.eip.aimcp;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class OrderClassifierRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        rest("/api/orders")
            .post("/classify")
            .consumes("application/json")
            .produces("application/json")
            .to("direct:classify-order");

        from("direct:classify-order")
            .routeId("classify-order")
            .log("Classifying order: ${body}")
            // CHAT_SINGLE_MESSAGE (the default operation) sends the message
            // body to the model, so the instructions go in the body. There is
            // no "prompt" header: a header here is never seen by the model.
            .setBody(simple(
                "You are an order classification assistant for a shipping company. "
                + "Classify the following order and return a JSON object with these fields: "
                + "category (one of: ELECTRONICS, PERISHABLE, HAZARDOUS, FRAGILE, STANDARD), "
                + "priority (one of: CRITICAL, HIGH, MEDIUM, LOW), "
                + "fulfillmentType (one of: SAME_DAY, NEXT_DAY, STANDARD, ECONOMY). "
                + "Only return the JSON, no other text. Order: ${body}"))
            .to("langchain4j-chat:classifier")
            .log("Classification result: ${body}");
    }
}
```

The route logic is identical -- the only difference is the class annotation (`@ApplicationScoped` for Quarkus CDI, `@Component` for Spring). This is the pattern throughout: Camel's Java DSL is runtime-agnostic; only the dependency injection annotations and configuration properties change.

Test the classifier:

```bash
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Lithium Battery Pack","quantity":50,"destination":"Berlin"}'
```

Expected response (actual wording varies by model):

```json
{
  "category": "HAZARDOUS",
  "priority": "HIGH",
  "fulfillmentType": "STANDARD"
}
```

The LLM recognizes that lithium batteries are hazardous materials and adjusts the classification accordingly -- something that would require a complex rules engine or extensive lookup tables in a traditional integration.

## Chat model configuration

The LangChain4j Chat component is model-agnostic. You configure the model provider through runtime properties, not in the route. This means switching from a local Ollama model to OpenAI or Azure OpenAI is a configuration change with zero route modifications.

### Ollama (local)

Ollama runs models locally with no API key. It is the default for this tutorial's examples.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties (quarkus-langchain4j-ollama supplies the ChatModel bean)
quarkus.langchain4j.ollama.chat-model.model-id=qwen2.5:3b
quarkus.langchain4j.ollama.base-url=http://localhost:11434
quarkus.langchain4j.ollama.timeout=120s
```

```properties
# Spring Boot — application.properties, read by AgentConfig, which builds the
# OllamaChatModel itself (the langchain4j Ollama starter does not support Spring Boot 4)
ollama.model-name=qwen2.5:3b
ollama.base-url=http://localhost:11434
```

### OpenAI

For cloud-based inference with OpenAI models:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties
quarkus.langchain4j.openai.chat-model.model-name=gpt-4o
quarkus.langchain4j.openai.api-key=${OPENAI_API_KEY}
camel.component.langchain4j-chat.chat-model=quarkusChatModel
```

```properties
# Spring Boot — application.properties
langchain4j.open-ai.chat-model.model-name=gpt-4o
langchain4j.open-ai.chat-model.api-key=${OPENAI_API_KEY}
```

Using the OpenAI provider requires adding the corresponding dependency -- `quarkus-langchain4j-openai` for Quarkus or `langchain4j-open-ai-spring-boot-starter` for Spring Boot -- instead of the Ollama dependency.

### Azure OpenAI

For enterprise deployments with Azure-managed models:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — application.properties
quarkus.langchain4j.azure-openai.chat-model.resource-name=my-resource
quarkus.langchain4j.azure-openai.chat-model.deployment-name=gpt-4o
quarkus.langchain4j.azure-openai.api-key=${AZURE_OPENAI_KEY}
camel.component.langchain4j-chat.chat-model=quarkusChatModel
```

```properties
# Spring Boot — application.properties
langchain4j.azure-open-ai.chat-model.endpoint=https://my-resource.openai.azure.com/
langchain4j.azure-open-ai.chat-model.deployment-name=gpt-4o
langchain4j.azure-open-ai.chat-model.api-key=${AZURE_OPENAI_KEY}
```

### Model parameters

Common tuning parameters apply to all providers:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `temperature` | 0.7 | Controls randomness. Lower values (0.1) for classification, higher (0.9) for creative text. |
| `max-tokens` | model-dependent | Maximum response length. Set explicitly for predictable output. |
| `top-p` | 1.0 | Nucleus sampling threshold. Alternative to temperature for controlling diversity. |
| `timeout` | 60s | Request timeout. Increase for large prompts or slow models. |

For the order classifier, a low temperature (0.1-0.3) works best because you want deterministic, consistent classifications rather than creative variation.

## Tool calling

Tool calling is the transformative feature of the Camel LangChain4j integration. Instead of the developer writing explicit logic to decide when and how to call downstream services, the AI agent decides autonomously which tools to invoke based on the user's request and the available tool descriptions. The developer provides the tools and the agent provides the orchestration.

Camel supports three approaches to giving tools to AI agents.

### Camel route tools

The `ai-tool` component lets you register any Camel route as a tool that an AI agent can call. The route becomes a consumer that is invoked when the agent decides it needs that tool's capability:

```
from("ai-tool:toolName?tags=tag1,tag2&description=What this tool does&parameter.name=string")
```

The key parameters:

| Parameter | Description |
|-----------|-------------|
| `toolName` | The name the LLM sees and uses to invoke the tool |
| `tags` | Comma-separated tags that connect tools to agents. Omit them and the tool lands in a default pool available to every producer |
| `description` | Natural-language description that the LLM uses to decide when to call this tool |
| `parameter.NAME` | A typed input parameter — `string`, `integer`, `number` or `boolean`. Add `.description`, `.required` and `.enum` to refine it |
| `argSchema` | A raw JSON Schema, for nested objects, arrays and `oneOf`. Mutually exclusive with `parameter.*` |

The description is critical -- it is the tool's documentation for the AI agent. A vague description like "looks up data" will lead to incorrect tool selection. A precise description like "Look up the status of a shipping order by order ID" tells the agent exactly when and how to use it.

Declaring parameters matters nearly as much. Without them the model has to smuggle its argument inside free text and the route has to parse it back out; with them, the model is told exactly what to supply and Camel delivers each value as an exchange header of the same name.

`ai-tool` also accepts four advisory hints — `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` — which are passed through to MCP clients as metadata. They describe intent to a client that cares to look; they are **not** authorization, and Camel does not enforce them.

> **Replacing `langchain4j-tools`.** Earlier versions of this appendix used the
> `langchain4j-tools:` consumer, which is deprecated as of Camel 4.22. The
> replacement is deliberately framework-neutral: `ai-tool` publishes into a
> shared `AiToolRegistry` that LangChain4j, Spring AI and the embedded MCP
> server all read from, so one route definition serves every consumer instead
> of being tied to LangChain4j.
>
> On the Spring AI side the same release went further and *removed*
> `camel-spring-ai-tools` outright rather than deprecating it, with the
> remaining `camel-spring-ai-*` components moving to Spring AI 2.0. Spring Boot
> users also get `camel-mcp-server-starter`, which exposes `ai-tool:` routes on
> the same MCP server as Spring AI's native `@McpTool` beans with no wiring
> between them.

### Tool-calling safety rails

Three 4.22 changes govern what happens when tool calling goes wrong, and the
first will change the behaviour of routes you have already written.

**Tool errors now go back to the model, not to your route.** When a tool
invocation throws, the failure is returned to the LLM so it can react —
retrying with different arguments, or explaining itself — rather than
propagating as an exception onto the calling exchange. If you wrapped an agent
call in `onException(...)` expecting to catch tool failures there, that handler
no longer fires. Two options control it:

```properties
# failExchange | repromptModel
camel.component.langchain4j-agent.toolExecutionErrorStrategy=failExchange
camel.component.langchain4j-agent.hallucinatedToolNameStrategy=repromptModel
```

Set `failExchange` to get the old behaviour back. `hallucinatedToolNameStrategy`
covers the related case where the model invents a tool that does not exist.

**Round trips are now bounded.** `maxToolCallingRoundTrips` defaults to 10. It
was previously unbounded, which meant a model that kept calling tools could loop
until something else gave out. If you have a legitimately deep tool chain, raise
it deliberately.

**Each tool call gets its own exchange.** Tool invocations run on an independent
exchange copy, and the arguments the model supplies are filtered against the
tool's declared parameter schema — so an LLM cannot inject an undeclared header
into your route by hallucinating an extra argument. This is why declaring typed
parameters, as `OrderLookupToolRoute` does below, is worth the small effort:
undeclared arguments are silently dropped.

One more thing worth knowing if you write a custom agent rather than using
Camel's built-in one: `Agent.chat()` now returns `Result<String>` instead of
`String`, and exposes token usage and finish reason as exchange headers, plus
`CamelLangChain4jAgentSources` and `CamelLangChain4jAgentToolExecutions` when
RAG or tools are in play. The examples here use the built-in
`AgentWithoutMemory`, so they are unaffected — but those headers are the hook
for tracking token cost, which is the operational concern that tends to arrive
shortly after the first thing works.

### OrderLookupToolRoute

This route registers itself as a tool that the AI agent can call to look up order statuses:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
package com.example.eip.aimcp;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

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
@ApplicationScoped
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
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FedEx\",\"eta\":\"2026-07-20\"}"))
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
```

```java
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
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FedEx\",\"eta\":\"2026-07-20\"}"))
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
```

In a production system, the `choice()` block would be replaced with an actual database query, a REST call to an order management system, or a Kafka lookup -- any Camel component. The route is a full Camel route with access to all 350+ components. The demo uses hardcoded responses to keep the example self-contained.

The `tags=shipping` parameter is what connects this tool to agents. Any `langchain4j-agent` producer with `tags=shipping` can invoke this route, and so can the embedded MCP server when configured with the same tag.

### Custom @Tool classes

For simpler tools that do not need Camel routing logic, you can use LangChain4j's `@Tool` annotation on plain Java methods:

```java
import dev.langchain4j.agent.tool.Tool;

@ApplicationScoped  // or @Component for Spring Boot
public class InventoryTools {

    @Tool("Check the current stock level for a product by SKU")
    public String checkStock(String sku) {
        // lookup logic
        return "{\"sku\":\"" + sku + "\",\"available\":42}";
    }

    @Tool("Calculate shipping cost for a package based on weight and destination")
    public String calculateShipping(String weightKg, String destination) {
        // calculation logic
        return "{\"cost\":12.50,\"currency\":\"USD\"}";
    }
}
```

These tools are automatically discovered and registered with any AI agent in the same application. The `@Tool` annotation's value serves the same purpose as the `description` parameter on `ai-tool` -- it tells the agent when to use the tool.

The tradeoff: `@Tool` methods are simpler to write but limited to in-process Java logic. Camel route tools (`ai-tool`) give you the full power of the Camel routing engine -- connect to Kafka, call REST APIs, transform messages, apply EIPs -- all as a single tool invocation from the agent's perspective.

### MCP client tools

The Model Context Protocol (MCP) defines a standard interface for AI tools. Camel's LangChain4j integration can consume tools from external MCP servers, giving your agents access to tools provided by third-party applications:

```java
from("direct:query-with-mcp-tools")
    .to("langchain4j-agent:agent?agent=#assistantAgent&tags=mcp-tools");
```

MCP tools are registered using the LangChain4j MCP client library. On Quarkus, the `quarkus-langchain4j-mcp` extension auto-discovers MCP servers configured in `application.properties`:

```properties
quarkus.langchain4j.mcp.filesystem.transport-type=stdio
quarkus.langchain4j.mcp.filesystem.command=npx
quarkus.langchain4j.mcp.filesystem.arguments=-y,@anthropic-ai/mcp-filesystem,/data
```

On Spring Boot, you configure MCP clients programmatically through LangChain4j's `McpToolProvider`:

```java
@Bean
public McpToolProvider mcpToolProvider() {
    var transport = new StdioMcpTransport.Builder()
        .command("npx")
        .arguments(List.of("-y", "@anthropic-ai/mcp-filesystem", "/data"))
        .build();
    return McpToolProvider.builder()
        .mcpClients(McpClient.using(transport).build())
        .build();
}
```

This means a Camel agent can call tools served by any MCP-compatible application -- filesystem access, database queries, web searches, GitHub operations, Slack messaging -- without writing custom integration code. The MCP server provides the tool; Camel provides the agent that uses it.

### Supplying the agent

`langchain4j-agent` does not build an agent for you when you reference one by name. The `?agent=#assistantAgent` in the next route resolves against a bean in the registry, so the application has to produce one:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
package com.example.eip.aimcp;

import java.time.Duration;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import io.smallrye.common.annotation.Identifier;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.apache.camel.component.langchain4j.agent.api.Agent;
import org.apache.camel.component.langchain4j.agent.api.AgentConfiguration;
import org.apache.camel.component.langchain4j.agent.api.AgentWithoutMemory;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Supplies the agent that {@code langchain4j-agent:} endpoints reference by name.
 *
 * <p>The chat model is built here rather than injecting the {@code ChatModel}
 * that quarkus-langchain4j produces. That bean drives the
 * {@code langchain4j-chat} classifier fine, but the agent never offered the
 * registered {@code ai-tool} routes to the model through it — the model
 * answered in a single round trip and {@code toolExecutions} came back empty.
 * Building the model directly, exactly as the Spring Boot variant does, makes
 * tool calling work on both runtimes.
 *
 * <p>{@link AgentWithoutMemory} treats every exchange as an independent
 * conversation. For a multi-turn assistant, produce an {@code AgentWithMemory}
 * and set a {@code ChatMemoryProvider} on the {@link AgentConfiguration}.
 */
@ApplicationScoped
public class AgentProducers {

    @ConfigProperty(name = "quarkus.langchain4j.ollama.base-url", defaultValue = "http://localhost:11434")
    String baseUrl;

    @ConfigProperty(name = "quarkus.langchain4j.ollama.chat-model.model-id", defaultValue = "qwen2.5:3b")
    String modelName;

    @Produces
    @Identifier("assistantAgent")
    Agent assistantAgent() {
        ChatModel chatModel = OllamaChatModel.builder()
            .baseUrl(baseUrl)
            .modelName(modelName)
            .timeout(Duration.ofSeconds(120))
            .build();

        AgentConfiguration config = new AgentConfiguration()
            .withChatModel(chatModel);

        return new AgentWithoutMemory(config);
    }
}
```

```java
package com.example.eip.aimcp;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import org.apache.camel.component.langchain4j.agent.api.Agent;
import org.apache.camel.component.langchain4j.agent.api.AgentConfiguration;
import org.apache.camel.component.langchain4j.agent.api.AgentWithoutMemory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Supplies the chat model and the agent that {@code langchain4j-agent:}
 * endpoints reference by name.
 *
 * <p>The model is built here rather than through
 * {@code langchain4j-ollama-spring-boot-starter}. That starter's
 * auto-configuration builds its HTTP client against Spring Boot 3 classes which
 * moved in Spring Boot 4, so it fails at startup with a
 * {@code NoClassDefFoundError} on {@code ClientHttpRequestFactoryBuilder}.
 * Constructing the model directly uses LangChain4j's default JDK HTTP client
 * and avoids the Spring auto-configuration entirely.
 */
@Configuration
public class AgentConfig {

    @Bean
    public ChatModel chatModel(
            @Value("${ollama.base-url:http://localhost:11434}") String baseUrl,
            @Value("${ollama.model-name:qwen2.5:3b}") String modelName) {
        return OllamaChatModel.builder()
            .baseUrl(baseUrl)
            .modelName(modelName)
            .timeout(Duration.ofSeconds(60))
            .build();
    }

    /**
     * The bean name is what {@code ?agent=#assistantAgent} resolves against.
     *
     * <p>{@link AgentWithoutMemory} treats every exchange as an independent
     * conversation. For a multi-turn assistant, return an {@code AgentWithMemory}
     * and set a {@code ChatMemoryProvider} on the {@link AgentConfiguration}.
     */
    @Bean
    public Agent assistantAgent(ChatModel chatModel) {
        AgentConfiguration config = new AgentConfiguration()
            .withChatModel(chatModel);

        return new AgentWithoutMemory(config);
    }
}
```

On Quarkus the `@Identifier` value is the lookup name; on Spring Boot it is the bean name, which defaults to the method name. Either way `#assistantAgent` finds it.

`AgentWithoutMemory` treats each exchange as an independent conversation. Swap it for `AgentWithMemory`, with a `ChatMemoryProvider` set on the `AgentConfiguration`, to carry context across turns — see [Conversation memory](#conversation-memory) below.

As an alternative to producing the bean yourself, set `agentConfiguration` on the endpoint and let Camel construct the agent inline; Camel then picks `AgentWithMemory` or `AgentWithoutMemory` depending on whether a `ChatMemoryProvider` is configured.

### OrderAssistantRoute

The assistant route brings tool calling together. It defines a conversational REST endpoint backed by an AI agent that can autonomously call the order lookup tool:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
package com.example.eip.aimcp;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderAssistantRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        // The question is plain text, not a JSON document. Declaring it as
        // application/json makes langchain4j-agent reject the body: its
        // converter only accepts text/*, image/*, audio/*, video/* and
        // application/pdf, so a JSON content type fails before the agent runs.
        rest("/api/assistant")
            .post("/chat")
            .consumes("text/plain")
            .produces("text/plain")
            .to("direct:assistant-chat");

        from("direct:assistant-chat")
            .routeId("assistant-chat")
            // The agent needs the question as a String; the HTTP layer hands
            // over a stream.
            .convertBodyTo(String.class)
            .log("Assistant query: ${body}")
            // The agent takes the system prompt as its own header and the user
            // query as the body, rather than the two being concatenated into a
            // single chat prompt.
            .setHeader("CamelLangChain4jAgentSystemMessage", constant(
                "You are a helpful shipping order assistant. You can look up order statuses "
                + "using the available tools. Be concise and helpful."))
            // tags=shipping selects the ai-tool routes this agent may call.
            .to("langchain4j-agent:assistant?agent=#assistantAgent&tags=shipping")
            .log("Assistant response: ${body}");
    }
}
```

```java
package com.example.eip.aimcp;

import org.apache.camel.builder.RouteBuilder;
import org.springframework.stereotype.Component;

@Component
public class OrderAssistantRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        // The question is plain text, not a JSON document. Declaring it as
        // application/json makes langchain4j-agent reject the body: its
        // converter only accepts text/*, image/*, audio/*, video/* and
        // application/pdf, so a JSON content type fails before the agent runs.
        rest("/api/assistant")
            .post("/chat")
            .consumes("text/plain")
            .produces("text/plain")
            .to("direct:assistant-chat");

        from("direct:assistant-chat")
            .routeId("assistant-chat")
            // The agent needs the question as a String; the HTTP layer hands
            // over a stream.
            .convertBodyTo(String.class)
            .log("Assistant query: ${body}")
            // The agent takes the system prompt as its own header and the user
            // query as the body, rather than the two being concatenated into a
            // single chat prompt.
            .setHeader("CamelLangChain4jAgentSystemMessage", constant(
                "You are a helpful shipping order assistant. You can look up order statuses "
                + "using the available tools. Be concise and helpful."))
            // tags=shipping selects the ai-tool routes this agent may call.
            .to("langchain4j-agent:assistant?agent=#assistantAgent&tags=shipping")
            .log("Assistant response: ${body}");
    }
}
```

The critical piece is `tags=shipping` on the `langchain4j-agent` producer. This tells the component to offer the agent every `ai-tool` route tagged `shipping`. When the user asks "What is the status of order ORD-001?", the agent:

1. Receives the user's query via the prompt header
2. Recognizes that it needs order status information
3. Autonomously calls the `OrderLookupToolRoute` with "ORD-001"
4. Receives the JSON response from the tool
5. Formulates a natural-language answer incorporating the tool's data

Test the assistant:

```bash
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: text/plain" \
  -d 'What is the status of order ORD-001?'
```

Expected response:

```
Order ORD-001 has been shipped via FedEx with an estimated arrival date of July 20, 2026.
```

The agent composed a human-readable answer from the structured JSON returned by the tool. This is the power of combining LLM reasoning with Camel's integration capabilities -- the agent decides what to do, and Camel routes handle the how.

## MCP tools integration

The Model Context Protocol (MCP) is an open standard that defines how AI agents discover and invoke tools. Rather than each agent framework inventing its own tool interface, MCP provides a universal protocol: agents discover tools through a standardized listing, call them with structured inputs, and receive structured outputs.

Camel's LangChain4j integration supports MCP through the LangChain4j MCP client library. This means Camel agents can consume tools from any MCP-compatible server -- the same servers used by Claude Code, GitHub Copilot, Cursor, and other AI assistants.

### MCP transport types

MCP supports two transport mechanisms:

**STDIO** -- the server runs as a subprocess and communicates over stdin/stdout. This is the most common transport for local tools:

```properties
# Quarkus
quarkus.langchain4j.mcp.filesystem.transport-type=stdio
quarkus.langchain4j.mcp.filesystem.command=npx
quarkus.langchain4j.mcp.filesystem.arguments=-y,@anthropic-ai/mcp-filesystem,/data
```

**HTTP/SSE** -- the server runs as a remote service and communicates over HTTP with Server-Sent Events for streaming. This is the transport for networked and shared tools:

```properties
# Quarkus
quarkus.langchain4j.mcp.remote-tools.transport-type=http
quarkus.langchain4j.mcp.remote-tools.url=http://mcp-server:8080/mcp
```

### Combining MCP tools with Camel route tools

An agent can use both MCP tools and Camel route tools simultaneously. The MCP tools handle external capabilities (filesystem, databases, APIs) while Camel route tools handle internal integrations (Kafka, message transformation, routing decisions):

```java
from("direct:smart-assistant")
    .setHeader("CamelLangChain4jAgentSystemMessage", constant(
        "You have access to both shipping tools and filesystem tools."))
    .to("langchain4j-agent:assistant?agent=#assistantAgent&tags=shipping,filesystem");
```

The agent sees all tools -- both Camel routes and MCP servers -- as a flat list and selects the appropriate ones based on the user's query. From the agent's perspective, there is no difference between a Camel route tool and an MCP tool.

## Conversation memory

By default, each call to the `langchain4j-chat` producer is stateless -- the model has no memory of previous exchanges. Memory belongs to the agent: for conversational use cases like the order assistant, give the `langchain4j-agent` a `ChatMemory` to maintain context across turns.

LangChain4j provides `MessageWindowChatMemory`, which stores the last N messages in a sliding window:

```java
@ApplicationScoped  // or @Component for Spring Boot
public class ChatMemoryConfig {

    @Produces  // or @Bean for Spring Boot
    public ChatMemoryProvider chatMemoryProvider() {
        return memoryId -> MessageWindowChatMemory.builder()
            .id(memoryId)
            .maxMessages(20)
            .build();
    }
}
```

When the agent is created from an `agentConfiguration` that carries a `ChatMemoryProvider`, Camel builds an `AgentWithMemory`; without one it builds an `AgentWithoutMemory`. The memory window is chosen per call by the `CamelLangChain4jAgentMemoryId` header.

### Session-based memory

For multi-user applications, you can key memory by session ID using a Camel header:

```java
from("direct:assistant-chat")
    .setHeader("CamelLangChain4jAgentMemoryId",
        header("X-Session-Id"))
    .to("langchain4j-agent:assistant?agent=#assistantAgent&tags=shipping");
```

Each session gets its own memory window. When the window fills, the oldest messages are dropped to stay within the configured limit.

### Persistent memory

The default `MessageWindowChatMemory` is in-memory and lost on restart. For persistent conversation history, you can implement a custom `ChatMemoryStore` backed by a database:

```java
@ApplicationScoped
public class PostgresChatMemoryStore implements ChatMemoryStore {

    @Inject
    DataSource dataSource;

    @Override
    public List<ChatMessage> getMessages(Object memoryId) {
        // SELECT from conversations WHERE memory_id = ?
    }

    @Override
    public void updateMessages(Object memoryId, List<ChatMessage> messages) {
        // UPSERT into conversations
    }

    @Override
    public void deleteMessages(Object memoryId) {
        // DELETE from conversations WHERE memory_id = ?
    }
}
```

This integrates naturally with the PostgreSQL instance in the tutorial's compose stack.

## RAG (Retrieval-Augmented Generation)

RAG grounds AI responses in domain-specific documents rather than relying solely on the model's training data. For a shipping company, this means the AI assistant can answer questions about specific shipping regulations, product handling requirements, or company policies by retrieving relevant documents before generating a response.

The RAG pipeline has three stages:

1. **Ingestion** -- documents are split into chunks, converted to embeddings, and stored in a vector database
2. **Retrieval** -- the user's query is converted to an embedding and used to find similar document chunks
3. **Augmentation** -- retrieved chunks are injected into the prompt as context before the LLM generates a response

### Document ingestion

Camel routes handle the ingestion pipeline -- reading documents from file systems, S3 buckets, or message queues and feeding them to the embedding store:

```java
from("file:docs/shipping-regulations?noop=true")
    .routeId("rag-ingestion")
    .log("Ingesting document: ${header.CamelFileName}")
    .to("langchain4j-embeddings:ingest");
```

### Retrieval and augmentation

The `ContentRetriever` and `RetrievalAugmentor` interfaces wire retrieval into the chat pipeline:

```java
@ApplicationScoped
public class RagConfig {

    @Produces
    public RetrievalAugmentor retrievalAugmentor(EmbeddingStore<TextSegment> store,
                                                  EmbeddingModel model) {
        ContentRetriever retriever = EmbeddingStoreContentRetriever.builder()
            .embeddingStore(store)
            .embeddingModel(model)
            .maxResults(5)
            .minScore(0.7)
            .build();

        return DefaultRetrievalAugmentor.builder()
            .contentRetriever(retriever)
            .build();
    }
}
```

When a `RetrievalAugmentor` bean is present, the LangChain4j Chat component automatically augments prompts with retrieved content. The agent's responses now reflect both its general knowledge and the specific documents in the embedding store.

### Embedding stores

LangChain4j supports multiple embedding stores. For the tutorial's compose stack, PostgreSQL with pgvector is a natural choice:

```properties
# Quarkus
quarkus.langchain4j.pgvector.dimension=384
quarkus.langchain4j.pgvector.table=shipping_docs
quarkus.datasource.jdbc.url=jdbc:postgresql://localhost:5432/eip
```

Other supported stores include Redis (already in the tutorial stack), Chroma, Milvus, Pinecone, and Weaviate.

## Guardrails

Guardrails validate inputs and outputs to prevent prompt injection, data leakage, and malformed responses. LangChain4j provides both input guardrails (applied before the prompt reaches the model) and output guardrails (applied to the model's response before it reaches the caller).

### Input guardrails

Input guardrails intercept the user's message before it is sent to the LLM:

```java
@ApplicationScoped
public class PiiDetectionGuardrail implements InputGuardrail {

    @Override
    public InputGuardrailResult validate(UserMessage userMessage) {
        String text = userMessage.singleText();

        // Check for credit card numbers
        if (text.matches(".*\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b.*")) {
            return fatal("PII detected: message contains what appears to be a credit card number. "
                + "Please remove sensitive data before submitting.");
        }

        // Check for SSN patterns
        if (text.matches(".*\\b\\d{3}-\\d{2}-\\d{4}\\b.*")) {
            return fatal("PII detected: message contains what appears to be a Social Security Number.");
        }

        return success();
    }
}
```

### Output guardrails

Output guardrails validate the model's response before returning it to the caller:

```java
@ApplicationScoped
public class JsonSchemaGuardrail implements OutputGuardrail {

    @Override
    public OutputGuardrailResult validate(AiMessage responseMessage) {
        String text = responseMessage.text();

        try {
            JsonNode json = new ObjectMapper().readTree(text);

            // Validate required fields
            if (!json.has("category") || !json.has("priority")) {
                return reprompt("Response must include 'category' and 'priority' fields. "
                    + "Please try again with the correct JSON structure.");
            }

            return success();
        } catch (JsonProcessingException e) {
            return reprompt("Response must be valid JSON. Please return only the JSON object.");
        }
    }
}
```

The `reprompt` result is significant -- instead of failing, it sends the validation error back to the LLM as feedback, giving the model a chance to correct its output. The component retries automatically (up to a configurable limit) until the output passes validation or the retry limit is reached.

### Keyword filtering

For simpler use cases, you can apply keyword-based input filtering directly in the Camel route without a dedicated guardrail class:

```java
from("direct:guarded-chat")
    .filter(simple("${body} not contains 'ignore all previous instructions'"))
    .filter(simple("${body} not contains 'system prompt'"))
    .to("langchain4j-chat:guarded");
```

This is a blunt instrument compared to proper guardrails, but it catches the most obvious prompt injection attempts with minimal overhead.

### Configuring guardrails with Camel

To attach guardrails to a specific chat operation, register them as beans and reference them in the component configuration:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Quarkus — guardrails are auto-discovered via CDI
# Annotate guardrail classes with @InputGuardrail or @OutputGuardrail
# and they are automatically applied to matching AI services
```

```properties
# Spring Boot — register guardrails as beans
# They are auto-discovered by the LangChain4j Spring Boot starter
```

The guardrail beans are automatically discovered and applied when using the appropriate LangChain4j AI Service pattern. For direct Camel `langchain4j-chat` usage, you can apply guardrail logic as Camel processors or filters in the route, as shown in the keyword filtering example above.

## Multimodal content

Modern LLMs accept more than text. Camel routes can feed images, PDFs, and audio to AI models for analysis, combining Camel's file and cloud storage components with LangChain4j's multimodal support.

### Image analysis

A Camel route that reads images from a directory and sends them to the LLM for analysis:

```java
from("file:incoming/package-photos?noop=true")
    .routeId("package-inspection")
    .log("Inspecting package photo: ${header.CamelFileName}")
    .setHeader("CamelLangChain4jAgentUserMessage", constant(
        "Inspect this package photo. Report any visible damage, "
        + "incorrect labeling, or security concerns."))
    .setHeader("CamelLangChain4jAgentMediaType", constant("image/jpeg"))
    .to("langchain4j-agent:inspector?agent=#packageInspector")
    .log("Inspection result: ${body}");
```

There is no conversion code here because the agent does it. When the body is a
file — as it is coming from the `file:` consumer — `langchain4j-agent` builds
the multimodal message itself, pairing the file content with the text in
`CamelLangChain4jAgentUserMessage`. Before Camel 4.22 this route needed a
processor to read the bytes, wrap them in an `ImageContent`, wrap the prompt in
a `TextContent`, and assemble a `UserMessage`; all of that is now handled for
you.

`CamelLangChain4jAgentMediaType` is optional. Camel infers the MIME type from
the file extension, so it is only needed when the extension is missing or
misleading — it is set here to keep this JPEG-specific example explicit.

The model behind the agent must be vision-capable. A text-only model will
either reject the request or silently ignore the image, which is the more
confusing outcome of the two.

### Document processing

PDF documents can be processed using Camel's file component combined with LangChain4j's document parsers:

```java
from("file:incoming/customs-forms?noop=true&include=.*\\.pdf")
    .routeId("customs-processing")
    .log("Processing customs form: ${header.CamelFileName}")
    .bean("pdfTextExtractor")
    .setBody(simple(
        "Extract the following fields from this customs declaration form: "
        + "shipper name, consignee, commodity description, declared value, "
        + "country of origin, HS code. Return as JSON. Document: ${body}"))
    .to("langchain4j-chat:customs-extractor")
    .log("Extracted customs data: ${body}");
```

This pattern turns unstructured documents into structured data that downstream Camel routes can process -- store in a database, enrich with additional lookups, or route based on extracted values.

### Cloud storage integration

Combine with Camel's AWS S3 or Azure Blob components to process files from cloud storage:

```java
from("aws2-s3:shipping-documents?prefix=invoices/")
    .routeId("invoice-extraction")
    .bean("pdfTextExtractor")
    .setBody(simple(
        "Extract line items, totals, and payment terms from this invoice: ${body}"))
    .to("langchain4j-chat:invoice-extractor")
    .to("direct:store-extracted-invoice");
```

## The embedded Camel MCP Server

The previous sections covered Camel as an MCP *client* -- consuming tools from external MCP servers. Camel 4.22 can also act as an MCP *server*, publishing the `ai-tool` routes in your own application to any MCP-compatible client.

Keep this distinct from the catalog server in the next section. They share a name and almost nothing else:

| | Embedded MCP Server | Camel Catalog MCP Server |
|---|---|---|
| Exposes | Your application's `ai-tool` routes | The Apache Camel Catalog |
| Audience | Agents and MCP clients calling your business logic | AI coding assistants helping you write routes |
| Runs | Inside your application | As a standalone JBang process |
| Artifact | `camel-mcp-server` | `org.apache.camel:camel-jbang-mcp:4.22.1:runner` via JBang |

The embedded server does not implement a transport of its own. It bridges the tool registry to whatever MCP server the hosting runtime provides — Quarkus' MCP extension, Spring AI's MCP server, or the Vert.x engine bundled with Camel Main.

### Exposure is opt-in, by tag

Nothing is published unless you name a tag. The untagged default pool — the one an `ai-tool` route lands in when you omit `tags` — is *never* exposed, so a tool cannot become externally reachable just because someone forgot to tag it.

The order-status tool defined earlier is already tagged `shipping`, so it needs no change to be published:

```
ai-tool:order-status
    ?tags=shipping
    &description=Look up the status of a shipping order by order ID
    &parameter.orderId=string
```

That single definition now serves both consumers: the LangChain4j agent inside the application, and external MCP clients.

### Configuration

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```properties
# Add the camel-quarkus-mcp-server extension.
# Transport belongs to Quarkus' MCP server, configured under quarkus.mcp.server.*
quarkus.camel.mcp-server.enabled=true
quarkus.camel.mcp-server.tags=shipping
quarkus.camel.mcp-server.tool-timeout=20000
```

```properties
# Add the camel-mcp-server-starter.
# Spring AI's Web MVC MCP transport serves SSE: GET /sse, then POST /mcp/message.
camel.mcp-server.enabled=true
camel.mcp-server.tags=shipping
camel.mcp-server.tool-timeout=20000
```

For Camel Main and JBang, the bundled Vert.x engine serves streamable HTTP directly:

```properties
camel.server.enabled=true
camel.server.mcp-enabled=true
camel.server.mcp-tags=shipping
camel.server.mcp-server-name=shipping-tools
```

`tool-timeout` bounds a single tool call at 20 seconds by default. On expiry the MCP client receives an error result, but note that the underlying Camel route is not cancelled — it keeps running until it finishes on its own.

### Transports

With an HTTP transport the client discovers and invokes tools through the runtime's MCP endpoint. The two example applications publish different transports on port 8088:

| Runtime | Transport | Endpoint |
|---|---|---|
| Quarkus (Quarkus MCP server) | Streamable HTTP; SSE also offered | `POST /mcp`; `/mcp/sse` |
| Spring Boot (Spring AI Web MVC) | SSE | `GET /sse` returns the message endpoint, `POST /mcp/message?sessionId=...` |
| Camel Main and JBang (Vert.x) | Streamable HTTP | `/mcp` |

Point an MCP client at the one your runtime serves. Against the Quarkus application, plain `curl` is enough to see the tool from the outside — `initialize`, then `tools/call`, carrying the session id the first response returns:

```bash
curl -s -D headers.txt -X POST localhost:8088/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
SID=$(awk 'tolower($1)=="mcp-session-id:"{print $2}' headers.txt | tr -d '\r')
curl -s -X POST localhost:8088/mcp -H "Mcp-Session-Id: $SID" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'
curl -s -X POST localhost:8088/mcp -H "Mcp-Session-Id: $SID" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"order-status","arguments":{"orderId":"ORD-002"}}}'
```

```json
{"jsonrpc":"2.0","id":2,"result":{"isError":false,"content":[{"text":"{\"orderId\":\"ORD-002\",\"status\":\"PROCESSING\",\"warehouse\":\"West Coast Hub\"}","type":"text"}], ...}}
```

The same `ai-tool` route answers, and logs `Tool call — looking up order: ORD-002`, exactly as when the in-process agent calls it.

With stdio there is no HTTP endpoint at all: the client launches your application as a subprocess and speaks MCP over stdin and stdout. On Spring Boot that means swapping the Web MVC transport for Spring AI's plain MCP server starter, setting `spring.ai.mcp.server.stdio=true`, and disabling both the web application and console logging — anything written to stdout other than protocol traffic corrupts the stream.

### Hints are not authorization

`ai-tool` carries four advisory hints that the bridge forwards as MCP tool metadata:

| Hint | Says |
|------|------|
| `readOnlyHint` | The tool only reads; it does not modify state |
| `destructiveHint` | The tool may make destructive or irreversible updates |
| `idempotentHint` | Repeating the call with the same arguments changes nothing further |
| `openWorldHint` | The tool reaches systems outside the application's control |

These are descriptions of intent for clients that choose to read them. Camel does not enforce any of them, and an MCP client is free to ignore them entirely. Publishing a tool over MCP makes it callable by whoever can reach the endpoint, so authentication and authorization remain your application's job — exactly as they would be for a REST endpoint exposing the same logic.

## The Camel Catalog MCP Server

The catalog server is the other half of the story: it exposes the Apache Camel Catalog itself as an MCP server, making Camel's documentation and metadata available to AI coding assistants.

When you are writing Camel routes in an IDE with an AI assistant (Claude Code, GitHub Copilot, Cursor), the assistant can query the Camel MCP Server for:

- **Component documentation** -- endpoint parameters, default values, required options
- **EIP patterns** -- which pattern to use for a given integration scenario
- **Data format options** -- JSON, XML, YAML serialization configuration
- **Language expressions** -- Simple, OGNL, JSONPath, XPath syntax reference

### Running the Camel MCP Server

The Camel MCP Server is available through the Camel CLI (JBang):

```bash
camel mcp
```

This starts the MCP server with STDIO transport, suitable for direct integration with AI assistants. For network access, use HTTP/SSE transport:

```bash
camel mcp --http --port 8080
```

### Configuring AI assistants

To use the Camel MCP Server with Claude Code, add it to your MCP configuration:

```json
{
  "mcpServers": {
    "camel": {
      "type": "stdio",
      "command": "jbang",
      "args": ["-Dquarkus.log.level=WARN", "org.apache.camel:camel-jbang-mcp:4.22.1:runner"]
    }
  }
}
```

For VS Code with GitHub Copilot or Continue, add the same configuration to your workspace's MCP settings. The AI assistant can then query Camel documentation inline while you write route code.

### Available tools

The Camel MCP Server exposes several tools:

| Tool | Description |
|------|-------------|
| `camel-catalog-component` | Look up component documentation, parameters, and examples |
| `camel-catalog-dataformat` | Look up data format options and configuration |
| `camel-catalog-language` | Look up expression language syntax |
| `camel-catalog-eip` | Look up Enterprise Integration Pattern documentation |
| `camel-catalog-main` | Look up Camel Main configuration options |

When an AI assistant encounters a Camel route, it can query these tools to provide accurate completions, catch configuration errors, and suggest best practices.

## Wanaku

Wanaku is an MCP router that exposes existing Camel routes as MCP-compatible tools without modifying the routes themselves. While the `ai-tool` component requires routes to be written specifically as tools (using the `ai-tool:` consumer), Wanaku works with any HTTP-accessible Camel route.

### How Wanaku works

Wanaku sits between AI agents and your Camel integrations:

1. You register your Camel REST endpoints in Wanaku's service catalog
2. Wanaku generates MCP tool definitions from the catalog entries
3. AI agents discover and call tools through Wanaku's MCP interface
4. Wanaku translates MCP tool calls into HTTP requests to your Camel routes

This means every Camel route you have already built -- the hundreds of integrations connecting your systems -- can become available to AI agents with zero code changes.

### Service catalog

Register a Camel route as a Wanaku tool:

```bash
wanaku tools add \
  --name "order-status" \
  --description "Look up the current status of a shipping order by order ID" \
  --url "http://localhost:8088/api/orders/{orderId}/status" \
  --method GET \
  --parameter "orderId:string:The order identifier (e.g., ORD-001)"
```

### Templates

Wanaku templates define reusable patterns for common Camel route types. Instead of registering each route individually, define a template and Wanaku auto-discovers matching routes:

```yaml
name: camel-rest-api
description: Auto-discover Camel REST API endpoints
discovery:
  type: openapi
  url: http://localhost:8088/api/openapi.json
parameter-mapping:
  path-params: tool-arguments
  query-params: tool-arguments
  body: tool-content
```

With OpenAPI-based discovery, Wanaku reads your Camel REST API's OpenAPI specification and automatically generates MCP tools for every endpoint. When you add new Camel routes, Wanaku picks them up on the next discovery cycle.

### Wanaku with the shipping domain

For the tutorial's shipping domain, Wanaku could expose the entire suite of Camel integrations as AI tools:

| Wanaku Tool | Camel Route | Description |
|-------------|-------------|-------------|
| `classify-order` | OrderClassifierRoute | AI-powered order classification |
| `lookup-order` | OrderLookupToolRoute | Check order status |
| `check-inventory` | InventoryRoute | Query warehouse stock levels |
| `track-shipment` | ShipmentTrackingRoute | Get real-time tracking data |
| `send-notification` | NotificationRoute | Send customer notifications |

An AI agent connected to Wanaku could handle complex customer queries end-to-end: "Check the status of my order ORD-001, and if it's delayed, send me a notification with the new ETA." The agent would call `lookup-order`, evaluate the response, and conditionally call `send-notification` -- all through existing Camel routes.

## Shipping domain example walkthrough

Let us walk through the complete flow of the example application. Start the application (either runtime) and Ollama, then follow along.

### Step 1: Classify an order

Send a natural-language order description to the classifier:

```bash
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Lithium Battery Pack","quantity":50,"destination":"Berlin"}'
```

The classifier route:
1. Receives the JSON body via REST
2. Replaces the body with the instructions plus the order data (the prompt)
3. Sends the prompt to the LLM via `langchain4j-chat:classifier`
4. Returns the LLM's JSON classification

A response from `qwen2.5:3b`:

```json
{"category":"HAZARDOUS","priority":"CRITICAL","fulfillmentType":"SAME_DAY"}
```

The model identifies lithium batteries as hazardous. The priority and fulfillment type vary between runs and models — the category is the stable part.

### Step 2: Ask the assistant about an order

Send a natural-language question to the assistant:

```bash
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: text/plain" \
  -d 'What is the status of order ORD-001?'
```

The assistant route:
1. Receives the question via REST
2. Sets the prompt header with the system instructions and user query
3. Sends to `langchain4j-agent:assistant?agent=#assistantAgent&tags=shipping`
4. The agent recognizes it needs order data and calls the `OrderLookupToolRoute`
5. The tool returns `{"orderId":"ORD-001","status":"SHIPPED","carrier":"FedEx","eta":"2026-07-20"}`
6. The agent formulates a natural-language response

A response (worded differently each run):

```
The status of order ORD-001 is SHIPPED. It's being transported by FedEx with an estimated arrival time of 2026-07-20.
```

The application log shows the tool call that produced it: `Tool call — looking up order: ORD-001`.

### Step 3: Try different orders

```bash
# Processing order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: text/plain" \
  -d 'Is ORD-002 ready to ship?'

# Delivered order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: text/plain" \
  -d 'Has order ORD-003 been delivered?'

# Unknown order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: text/plain" \
  -d 'Where is order ORD-999?'
```

### Step 4: Classify different product types

```bash
# Perishable item
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Fresh Atlantic Salmon","quantity":200,"destination":"Chicago","temperature":"refrigerated"}'

# Fragile electronics
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Crystal Wine Glasses","quantity":24,"destination":"New York","packaging":"bubble wrap"}'

# Standard bulk order
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Cotton T-Shirts","quantity":500,"destination":"Los Angeles"}'
```

The assistant endpoint takes `text/plain`; posting `application/json` gets `415 Unsupported Media Type`. The agent calls the tool for each order, answers ORD-002 as processing at the West Coast Hub and ORD-003 as delivered, and says ORD-999 cannot be found.

The classifier sorts the salmon as `PERISHABLE`, the glasses as `FRAGILE` and the t-shirts as `STANDARD`. A 3B model does not always respect the allowed values, though: it has answered the t-shirts with `"priority":"STANDARD"`, which is not one of the four priorities. Validate the model's JSON before routing on it (an output guardrail, or a `choice` that sends unknown values to a review queue).

Watch the application logs to see the tool calls and AI responses in real time. Each tool invocation is logged by the route, so you can trace the agent's decision-making process.

## Summary

The Camel LangChain4j integration transforms the way integration routes interact with AI. Rather than treating AI as an external service that requires custom HTTP clients and response parsing, Camel makes AI models first-class participants in integration flows:

- **LangChain4j Chat component** sends prompts to any LLM and returns responses as exchange bodies -- same programming model as any other Camel component
- **Tool calling** registers Camel routes as tools that AI agents invoke autonomously -- the agent decides when to call what
- **MCP integration** connects Camel agents to external MCP servers, combining Camel's 350+ connectors with the broader MCP tool ecosystem
- **Conversation memory** maintains context across turns for conversational use cases
- **RAG** grounds AI responses in domain-specific documents stored in vector databases
- **Guardrails** validate inputs and outputs to prevent prompt injection and data leakage
- **Multimodal support** processes images, PDFs, and audio through Camel routes
- **Camel MCP Server** exposes Camel's own catalog as an MCP server for AI coding assistants
- **Wanaku** makes existing Camel routes available as MCP tools without code changes

The shipping domain example demonstrates the practical application: an AI agent classifies orders using natural-language understanding and answers customer questions by calling Camel route tools. The route logic is identical across Quarkus and Spring Boot -- only annotations and configuration differ.

As AI agents become standard components in enterprise architectures, the integration layer becomes more important, not less. Every tool an agent calls, every document it retrieves, every system it updates goes through an integration. Camel's LangChain4j components ensure that integration is built on the same battle-tested patterns and components that have connected enterprise systems for over fifteen years.

## References

- [Camel LangChain4j Chat component](https://camel.apache.org/components/4.22.x/langchain4j-chat-component.html)
- [Camel AI Tool component](https://camel.apache.org/components/4.22.x/ai-tool-component.html)
- [Camel LangChain4j Agent component](https://camel.apache.org/components/4.22.x/langchain4j-agent-component.html)
- [LangChain4j documentation](https://docs.langchain4j.dev/)
- [Quarkus LangChain4j extension](https://docs.quarkiverse.io/quarkus-langchain4j/dev/index.html)
- [Camel MCP Server](https://camel.apache.org/manual/camel-jbang.html#_mcp)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [Wanaku MCP router](https://github.com/wanaku-ai/wanaku)

---

*Verification status: <span class="status status--verified">verified</span> — both runtime variants run on Camel 4.22.1 (Quarkus 3.40.1 / Spring Boot 4.1.1) against Ollama 0.40.2 with `qwen2.5:3b` on Docker Engine: the classifier returns JSON (lithium batteries `HAZARDOUS`, salmon `PERISHABLE`, glasses `FRAGILE`, t-shirts `STANDARD`); the assistant calls the `ai-tool` route for ORD-001, ORD-002, ORD-003 and ORD-999 (`Tool call — looking up order: …` for each) and answers from its data, with no route errors; and an external MCP client lists `order-status` and calls it — over streamable HTTP at `/mcp` on Quarkus and over SSE (`/sse`, `/mcp/message`) on Spring Boot — reaching the same route (2026-10-09). This run found and fixed the classifier: its instructions went in a header the chat component never reads.*
