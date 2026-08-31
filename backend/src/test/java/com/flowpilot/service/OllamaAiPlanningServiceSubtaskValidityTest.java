package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedSubtasksResponse;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/**
 * Spec: ai-subtask-generation — "Single-subtask draft is valid". A model result
 * with exactly one {@code {title, description}} is valid output — not an error,
 * not a 503, and no retry. This locks {@link OllamaAiPlanningService#generateSubtasks}
 * against a future minimum-count ({@code size() < 2}) regression in its parse
 * step. {@link OllamaAiPlanningServiceTest} is deliberately left untouched.
 */
class OllamaAiPlanningServiceSubtaskValidityTest {

    private final ObjectMapper json =
            new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private MockRestServiceServer server;
    private OllamaAiPlanningService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ollama.test");
        server = MockRestServiceServer.bindTo(builder).build();
        service = new OllamaAiPlanningService(builder.build(), "llama3", json);
    }

    @Test
    void aSingleSubtaskDraftIsValidAndReturnedAsAOneElementListWithoutError() throws Exception {
        String content =
                "{\"subtasks\":[{\"title\":\"Implementar el endpoint\",\"description\":\"contrato y validación\"}]}";
        String body = json.writeValueAsString(Map.of(
                "choices", List.of(Map.of("message", Map.of("role", "assistant", "content", content)))));
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

        GeneratedSubtasksResponse response = service.generateSubtasks("Título: X");

        assertThat(response.generatedBy()).isEqualTo(AiProvider.OLLAMA);
        assertThat(response.subtasks()).hasSize(1);
        assertThat(response.subtasks().get(0).title()).isEqualTo("Implementar el endpoint");
        assertThat(response.subtasks().get(0).description()).isEqualTo("contrato y validación");
        server.verify();
    }
}
