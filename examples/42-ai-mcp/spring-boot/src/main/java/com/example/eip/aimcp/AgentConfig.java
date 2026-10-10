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
