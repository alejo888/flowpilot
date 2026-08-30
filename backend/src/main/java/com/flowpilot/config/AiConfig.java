package com.flowpilot.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.service.AiPlanningService;
import com.flowpilot.service.OllamaAiPlanningService;
import com.flowpilot.service.StubAiPlanningService;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * The only wiring decision for AI-assisted planning (spec:
 * ai-user-story-generation — "Provider abstraction and fail-fast config").
 * First hand-written {@code @Configuration} in the codebase.
 *
 * <p>Design D1 — a total factory {@code @Bean}, not {@code
 * @ConditionalOnProperty} on two {@code @Service} classes: a mistyped or
 * absent property under {@code @ConditionalOnProperty} would yield zero beans
 * and an opaque {@code NoSuchBeanDefinitionException}; this method always
 * returns exactly one {@link AiPlanningService}.
 *
 * <p>Design D2 — fail fast only when enabled: {@code flowpilot.ai.*} has empty
 * defaults (see {@code application.yml}), mirroring {@code jwt.secret}. When
 * {@code flowpilot.ai.enabled=true} and either the Ollama base URL or model is
 * blank, this throws and the application context does not start.
 *
 * <p>Design D3 — timeouts via the version-independent {@code spring-web}
 * {@link SimpleClientHttpRequestFactory} {@code Duration} overloads (confirmed
 * against Spring Framework 7.0.7 / Spring Boot 4.0.3), handed to {@link
 * RestClient.Builder#requestFactory}.
 */
@Configuration
public class AiConfig {

    /** Design D3: connect timeout for the outbound Ollama call. */
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /** Design D3: read timeout for the outbound Ollama call. */
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(60);

    /**
     * Selects and builds the single {@link AiPlanningService}. Written as a
     * plain method (no field injection, no context) so it is unit-testable
     * directly (see {@code AiConfigTest}).
     *
     * <p>Takes no {@code ObjectMapper} bean parameter on purpose: the factory
     * builds its own lenient mapper (design — {@link OllamaAiPlanningService}
     * ignores unknown properties in the model's reply). Injecting the shared
     * Spring bean here also created a startup ordering hazard — this
     * {@code @Bean} can be built before {@code JacksonAutoConfiguration}.
     */
    /**
     * The one place {@code flowpilot.ai.enabled} is resolved for runtime
     * consumers (spec: ai-runtime-config). {@link
     * com.flowpilot.controller.AiConfigController} injects this bean instead of
     * repeating the {@code @Value} lookup, keeping a single source of truth for
     * the flag.
     */
    @Bean
    AiSettings aiSettings(@Value("${flowpilot.ai.enabled:false}") boolean enabled) {
        return new AiSettings(enabled);
    }

    @Bean
    AiPlanningService aiPlanningService(
            @Value("${flowpilot.ai.enabled:false}") boolean enabled,
            @Value("${flowpilot.ai.ollama.base-url:}") String ollamaBaseUrl,
            @Value("${flowpilot.ai.ollama.model:}") String ollamaModel) {
        if (!enabled) {
            return new StubAiPlanningService();
        }
        if (isBlank(ollamaBaseUrl) || isBlank(ollamaModel)) {
            throw new IllegalStateException(
                    "flowpilot.ai.enabled=true requires flowpilot.ai.ollama.base-url and flowpilot.ai.ollama.model");
        }
        RestClient restClient = RestClient.builder()
                .baseUrl(ollamaBaseUrl)
                .requestFactory(timeoutRequestFactory())
                .build();
        return new OllamaAiPlanningService(restClient, ollamaModel, lenientObjectMapper());
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    /** Lenient mapper for parsing the LLM reply — unknown properties are ignored (design). */
    static ObjectMapper lenientObjectMapper() {
        return new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    private static SimpleClientHttpRequestFactory timeoutRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT);
        factory.setReadTimeout(READ_TIMEOUT);
        return factory;
    }
}
