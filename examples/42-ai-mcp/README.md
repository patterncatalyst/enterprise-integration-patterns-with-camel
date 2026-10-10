# Appendix X: AI and MCP with Camel

AI-powered order classification and conversational assistant using Camel's LangChain4j integration. Both **Quarkus** and **Spring Boot** runtimes are provided — the Camel route logic is identical; only class annotations and configuration differ.

## Routes

| Route | Description |
|-------|-------------|
| `OrderClassifierRoute` | Accepts a natural-language order description via REST and uses an LLM to classify it by category, priority, and fulfillment type |
| `OrderLookupToolRoute` | A Camel route registered as a LangChain4j tool — the AI agent can call it to look up order status by ID |
| `OrderAssistantRoute` | A conversational REST endpoint where the AI agent answers shipping questions using the order lookup tool |

## Prerequisites

- Java 25+
- Maven 3.9+
- Ollama running locally with the `qwen2.5:3b` model (a model that calls tools; see the chapter)

## Setup

Pull the model and start the Ollama server:

```bash
ollama pull qwen2.5:3b
ollama serve
```

Or, without installing Ollama, the pinned container on the same port:

```bash
docker run -d --name ollama -p 127.0.0.1:11434:11434 -v ollama:/root/.ollama ollama/ollama:0.40.2
docker exec ollama ollama pull qwen2.5:3b
```

## Running

```bash
# Quarkus
cd examples/42-ai-mcp/quarkus
mvn quarkus:dev

# Spring Boot
cd examples/42-ai-mcp/spring-boot
mvn spring-boot:run
```

## Testing

Classify an order:

```bash
curl -X POST http://localhost:8088/api/orders/classify \
  -H "Content-Type: application/json" \
  -d '{"item":"Lithium Battery Pack","quantity":50,"destination":"Berlin"}'
```

Chat with the assistant:

```bash
curl -X POST http://localhost:8088/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '"What is the status of order ORD-001?"'
```

---

*Verification status: unverified. LangChain4j features reference Apache Camel 4.22.0 and LangChain4j 1.0.*
