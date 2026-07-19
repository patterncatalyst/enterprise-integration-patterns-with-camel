---
title: "Appendix X: AI and MCP with Camel"
order: 42
part: appendices
description: "Integrating AI into Camel routes — the LangChain4j Chat component for classification and tool calling, MCP servers for AI coding assistants, and Wanaku for exposing Camel routes as AI tools."
duration: "40 minutes"
---

Apache Camel connects to over 350 systems. AI agents need tools to interact with the real world -- databases, APIs, message brokers, file systems, cloud services. LangChain4j bridges these worlds. With Camel's LangChain4j components, Camel routes become AI tools that any LLM agent can call, and AI models become processors that sit inside Camel routes like any other component. A content-based router that once relied on hardcoded rules can now delegate classification to an LLM. A customer support pipeline can use an AI agent that looks up order statuses, checks inventory, and sends notifications -- all through existing Camel routes.

This appendix covers the full AI integration ecosystem for Camel:

- **LangChain4j Chat component** -- send messages to LLMs and receive responses as part of a Camel route
- **Tool calling** -- register Camel routes as tools that AI agents can invoke autonomously
- **MCP integration** -- connect Camel agents to external MCP servers and consume their tools
- **Conversation memory** -- maintain context across multiple turns in a chat session
- **RAG** -- ground AI responses in domain-specific documents
- **Guardrails** -- validate inputs and outputs to prevent misuse and data leakage
- **Multimodal content** -- send images, PDFs, and audio to AI models
- **Camel MCP Server** -- expose the Camel Catalog as an MCP server for AI coding assistants
- **Wanaku** -- an MCP router that makes existing Camel routes available as AI tools

The code is in `examples/42-ai-mcp/`.

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```bash
cd examples/42-ai-mcp/quarkus && mvn quarkus:dev
```

```bash
cd examples/42-ai-mcp/spring-boot && mvn spring-boot:run
```

Both runtimes require Ollama running locally with the `llama3.2` model:

```bash
ollama pull llama3.2
ollama serve
```

{% include excalidraw.html file="42-ai-mcp-architecture" alt="Camel AI/MCP architecture" caption="Figure X.1 — Camel AI integration architecture: routes produce to LangChain4j agents, which call back to Camel route tools and external MCP servers." %}

## The LangChain4j Chat component

The `langchain4j-chat` component is a producer-only component that sends messages to a LangChain4j `ChatModel` and returns the model's response as the exchange body. The URI format is straightforward:

```
langchain4j-chat:chatId[?options]
```

The `chatId` is a logical name that identifies the chat operation -- it does not select the model. The model is configured separately through runtime-specific configuration (Quarkus CDI or Spring Boot auto-configuration). Key options include:

| Option | Default | Description |
|--------|---------|-------------|
| `toolTags` | (none) | Comma-separated tags that select which `langchain4j-tools` routes the agent can call |
| `chatOperation` | `CHAT_SINGLE_MESSAGE` | `CHAT_SINGLE_MESSAGE` for one-shot, `CHAT_SINGLE_MESSAGE_WITH_PROMPT` when using the prompt header |

The prompt is set via the `CamelLangChain4jChatPrompt` header. This header accepts Simple expressions, so you can inject exchange data directly into the prompt:

```java
.setHeader("CamelLangChain4jChatPrompt", simple(
    "Classify this order: ${body}"))
.to("langchain4j-chat:classifier")
```

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
            .setHeader("CamelLangChain4jChatPrompt", simple(
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
            .setHeader("CamelLangChain4jChatPrompt", simple(
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
# Quarkus — application.properties
quarkus.langchain4j.ollama.chat-model.model-id=llama3.2
quarkus.langchain4j.ollama.base-url=http://localhost:11434
camel.component.langchain4j-chat.chat-model=quarkusChatModel
```

```properties
# Spring Boot — application.properties
langchain4j.ollama.chat-model.model-name=llama3.2
langchain4j.ollama.chat-model.base-url=http://localhost:11434
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

The `langchain4j-tools` component lets you register any Camel route as a tool that an AI agent can call. The route becomes a consumer that is invoked when the agent decides it needs that tool's capability:

```
from("langchain4j-tools:toolGroup?tags=tag1,tag2&description=What this tool does")
```

The key parameters:

| Parameter | Description |
|-----------|-------------|
| `toolGroup` | A logical group name for organizing related tools |
| `tags` | Comma-separated tags that connect tools to agents (must match the `toolTags` on the chat producer) |
| `description` | Natural-language description that the LLM uses to decide when to call this tool |

The description is critical -- it is the tool's documentation for the AI agent. A vague description like "looks up data" will lead to incorrect tool selection. A precise description like "Look up the status of a shipping order by order ID" tells the agent exactly when and how to use it.

### OrderLookupToolRoute

This route registers itself as a tool that the AI agent can call to look up order statuses:

{% include codetabs.html langs="Quarkus|Spring Boot" %}

```java
package com.example.eip.aimcp;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class OrderLookupToolRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        from("langchain4j-tools:orderTools?tags=shipping&description=Look up the status of a shipping order by order ID")
            .routeId("order-lookup-tool")
            .log("Tool call — looking up order: ${body}")
            .choice()
                .when(simple("${body} contains 'ORD-001'"))
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FedEx\",\"eta\":\"2026-07-20\"}"))
                .when(simple("${body} contains 'ORD-002'"))
                    .setBody(constant("{\"orderId\":\"ORD-002\",\"status\":\"PROCESSING\",\"warehouse\":\"West Coast Hub\"}"))
                .when(simple("${body} contains 'ORD-003'"))
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

@Component
public class OrderLookupToolRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        from("langchain4j-tools:orderTools?tags=shipping&description=Look up the status of a shipping order by order ID")
            .routeId("order-lookup-tool")
            .log("Tool call — looking up order: ${body}")
            .choice()
                .when(simple("${body} contains 'ORD-001'"))
                    .setBody(constant("{\"orderId\":\"ORD-001\",\"status\":\"SHIPPED\",\"carrier\":\"FedEx\",\"eta\":\"2026-07-20\"}"))
                .when(simple("${body} contains 'ORD-002'"))
                    .setBody(constant("{\"orderId\":\"ORD-002\",\"status\":\"PROCESSING\",\"warehouse\":\"West Coast Hub\"}"))
                .when(simple("${body} contains 'ORD-003'"))
                    .setBody(constant("{\"orderId\":\"ORD-003\",\"status\":\"DELIVERED\",\"deliveredAt\":\"2026-07-15\"}"))
                .otherwise()
                    .setBody(constant("{\"error\":\"Order not found\"}"))
            .end()
            .log("Tool response: ${body}");
    }
}
```

In a production system, the `choice()` block would be replaced with an actual database query, a REST call to an order management system, or a Kafka lookup -- any Camel component. The route is a full Camel route with access to all 350+ components. The demo uses hardcoded responses to keep the example self-contained.

The `tags=shipping` parameter is what connects this tool to agents. Any `langchain4j-chat` producer with `toolTags=shipping` can invoke this route.

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

These tools are automatically discovered and registered with any AI agent in the same application. The `@Tool` annotation's value serves the same purpose as the `description` parameter on `langchain4j-tools` -- it tells the agent when to use the tool.

The tradeoff: `@Tool` methods are simpler to write but limited to in-process Java logic. Camel route tools (`langchain4j-tools`) give you the full power of the Camel routing engine -- connect to Kafka, call REST APIs, transform messages, apply EIPs -- all as a single tool invocation from the agent's perspective.

### MCP client tools

The Model Context Protocol (MCP) defines a standard interface for AI tools. Camel's LangChain4j integration can consume tools from external MCP servers, giving your agents access to tools provided by third-party applications:

```java
from("direct:query-with-mcp-tools")
    .to("langchain4j-chat:agent?toolTags=mcp-tools");
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
```

```java
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
```

The critical piece is `toolTags=shipping` on the `langchain4j-chat` producer. This tells the component to register all `langchain4j-tools` routes tagged with `shipping` as available tools for this agent. When the user asks "What is the status of order ORD-001?", the agent:

1. Receives the user's query via the prompt header
2. Recognizes that it needs order status information
3. Autonomously calls the `OrderLookupToolRoute` with "ORD-001"
4. Receives the JSON response from the tool
5. Formulates a natural-language answer incorporating the tool's data

Test the assistant:

```bash
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"What is the status of order ORD-001?"'
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
    .setHeader("CamelLangChain4jChatPrompt", simple(
        "You have access to both shipping tools and filesystem tools. "
        + "Answer the user's question: ${body}"))
    .to("langchain4j-chat:assistant?toolTags=shipping,filesystem");
```

The agent sees all tools -- both Camel routes and MCP servers -- as a flat list and selects the appropriate ones based on the user's query. From the agent's perspective, there is no difference between a Camel route tool and an MCP tool.

## Conversation memory

By default, each call to the `langchain4j-chat` producer is stateless -- the model has no memory of previous exchanges. For conversational use cases like the order assistant, you need `ChatMemory` to maintain context across turns.

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

When a `ChatMemoryProvider` bean is present, the LangChain4j Chat component automatically uses it. Each unique `chatId` in the URI gets its own memory window, so the classifier and assistant maintain separate conversation histories.

### Session-based memory

For multi-user applications, you can key memory by session ID using a Camel header:

```java
from("direct:assistant-chat")
    .setHeader("CamelLangChain4jChatMemoryId",
        header("X-Session-Id"))
    .setHeader("CamelLangChain4jChatPrompt", simple("${body}"))
    .to("langchain4j-chat:assistant?toolTags=shipping");
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

This integrates naturally with the PostgreSQL instance in the tutorial's Podman stack.

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

LangChain4j supports multiple embedding stores. For the tutorial's Podman stack, PostgreSQL with pgvector is a natural choice:

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
    .setHeader("CamelLangChain4jChatPrompt", simple("${body}"))
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
    .process(exchange -> {
        byte[] imageBytes = exchange.getIn().getBody(byte[].class);
        ImageContent image = ImageContent.from(imageBytes, "image/jpeg");
        TextContent prompt = TextContent.from(
            "Inspect this package photo. Report any visible damage, "
            + "incorrect labeling, or security concerns.");
        UserMessage message = UserMessage.from(image, prompt);
        exchange.getIn().setBody(message);
    })
    .to("langchain4j-chat:inspector")
    .log("Inspection result: ${body}");
```

### Document processing

PDF documents can be processed using Camel's file component combined with LangChain4j's document parsers:

```java
from("file:incoming/customs-forms?noop=true&include=.*\\.pdf")
    .routeId("customs-processing")
    .log("Processing customs form: ${header.CamelFileName}")
    .bean("pdfTextExtractor")
    .setHeader("CamelLangChain4jChatPrompt", simple(
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
    .setHeader("CamelLangChain4jChatPrompt", simple(
        "Extract line items, totals, and payment terms from this invoice: ${body}"))
    .to("langchain4j-chat:invoice-extractor")
    .to("direct:store-extracted-invoice");
```

## The Camel MCP Server

The previous sections covered Camel as an MCP *client* -- consuming tools from external MCP servers. The Camel MCP Server flips the relationship: it exposes the Apache Camel Catalog itself as an MCP server, making Camel's documentation and metadata available to AI coding assistants.

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
      "command": "jbang",
      "args": ["camel@apache/camel", "mcp"]
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

Wanaku is an MCP router that exposes existing Camel routes as MCP-compatible tools without modifying the routes themselves. While the `langchain4j-tools` component requires routes to be written specifically as tools (using the `langchain4j-tools:` consumer), Wanaku works with any HTTP-accessible Camel route.

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
2. Sets the `CamelLangChain4jChatPrompt` header with instructions and the order data
3. Sends the prompt to the LLM via `langchain4j-chat:classifier`
4. Returns the LLM's JSON classification

Expected response:

```json
{
  "category": "HAZARDOUS",
  "priority": "HIGH",
  "fulfillmentType": "STANDARD"
}
```

The LLM correctly identifies lithium batteries as hazardous and assigns high priority because hazardous shipments require special handling.

### Step 2: Ask the assistant about an order

Send a natural-language question to the assistant:

```bash
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"What is the status of order ORD-001?"'
```

The assistant route:
1. Receives the question via REST
2. Sets the prompt header with the system instructions and user query
3. Sends to `langchain4j-chat:assistant?toolTags=shipping`
4. The agent recognizes it needs order data and calls the `OrderLookupToolRoute`
5. The tool returns `{"orderId":"ORD-001","status":"SHIPPED","carrier":"FedEx","eta":"2026-07-20"}`
6. The agent formulates a natural-language response

Expected response:

```
Order ORD-001 has been shipped via FedEx. The estimated delivery date is July 20, 2026.
```

### Step 3: Try different orders

```bash
# Processing order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"Is ORD-002 ready to ship?"'

# Delivered order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"Has order ORD-003 been delivered?"'

# Unknown order
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"Where is order ORD-999?"'
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

- [Camel LangChain4j Chat component](https://camel.apache.org/components/4.x/langchain4j-chat-component.html)
- [Camel LangChain4j Tools component](https://camel.apache.org/components/4.x/langchain4j-tools-component.html)
- [LangChain4j documentation](https://docs.langchain4j.dev/)
- [Quarkus LangChain4j extension](https://docs.quarkiverse.io/quarkus-langchain4j/dev/index.html)
- [Camel MCP Server](https://camel.apache.org/manual/camel-jbang.html#_mcp)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [Wanaku MCP router](https://github.com/wanaku-ai/wanaku)

---

*Verification status: unverified. LangChain4j features reference Apache Camel 4.20.0 and LangChain4j 1.0.*
