package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import com.flowpilot.exception.AiGenerationException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/**
 * The outbound Ollama call (spec: ai-user-story-generation — "Ollama
 * generation happy path", "LLM unreachable/slow/non-2xx -&gt; 503",
 * "Malformed model output -&gt; 503"; design D5/D6). Uses {@link
 * MockRestServiceServer} bound to the same {@link RestClient.Builder} — no
 * live model. Every expectation is {@code once()} so a stray retry fails
 * {@code server.verify()}.
 */
class OllamaAiPlanningServiceTest {

    private static final String VALID_STORY_JSON =
            """
            {"userStory":{"role":"analista","action":"exportar los datos a CSV","benefit":"analizarlos sin conexión"},
             "acceptanceCriteria":["Dado un proyecto cuando exporto entonces obtengo un CSV","El CSV respeta los filtros activos"]}""";

    private final ObjectMapper json =
            new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private RestClient.Builder builder;
    private MockRestServiceServer server;
    private OllamaAiPlanningService service;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder().baseUrl("http://ollama.test");
        server = MockRestServiceServer.bindTo(builder).build();
        service = new OllamaAiPlanningService(builder.build(), "llama3", json);
    }

    @Test
    void happyPathParsesSchemaConformantJsonAndComposesTheSentence() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.model").value("llama3"))
                .andExpect(jsonPath("$.stream").value(false))
                .andExpect(jsonPath("$.response_format.type").value("json_schema"))
                .andRespond(withSuccess(chatCompletion(VALID_STORY_JSON), MediaType.APPLICATION_JSON));

        GeneratedUserStoryResponse response = service.generateUserStory("Necesito exportar datos");

        assertThat(response.generatedBy()).isEqualTo(AiProvider.OLLAMA);
        assertThat(response.model()).isEqualTo("llama3");
        assertThat(response.userStory().role()).isEqualTo("analista");
        assertThat(response.userStory().text())
                .isEqualTo("Como analista quiero exportar los datos a CSV para analizarlos sin conexión");
        assertThat(response.acceptanceCriteria())
                .containsExactly("Dado un proyecto cuando exporto entonces obtengo un CSV",
                        "El CSV respeta los filtros activos");
        server.verify();
    }

    @Test
    void sendsTheSchemaTemperatureAndRawRequirementInTheRequestBody() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andExpect(jsonPath("$.temperature").value(0.2))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[1].content").value("texto <crudo> del usuario"))
                .andExpect(jsonPath("$.response_format.json_schema.schema.properties.acceptanceCriteria.type")
                        .value("array"))
                .andExpect(jsonPath("$.response_format.json_schema.schema.properties.userStory.required[0]")
                        .value("role"))
                .andRespond(withSuccess(chatCompletion(VALID_STORY_JSON), MediaType.APPLICATION_JSON));

        service.generateUserStory("texto <crudo> del usuario");

        server.verify();
    }

    @Test
    void downgradesToJsonObjectExactlyOnceOnASchemaRelated4xx() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andExpect(jsonPath("$.response_format.type").value("json_schema"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .body("{\"error\":\"response_format of type json_schema is not supported\"}")
                        .contentType(MediaType.APPLICATION_JSON));
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andExpect(jsonPath("$.response_format.type").value("json_object"))
                .andRespond(withSuccess(chatCompletion(VALID_STORY_JSON), MediaType.APPLICATION_JSON));

        GeneratedUserStoryResponse response = service.generateUserStory("algo");

        assertThat(response.userStory().role()).isEqualTo("analista");
        server.verify();
    }

    @Test
    void aTimeoutRaisesAiGenerationExceptionWithNoSecondCall() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(request -> {
                    throw new ResourceAccessException("simulated read timeout");
                });

        assertThatThrownBy(() -> service.generateUserStory("algo"))
                .isInstanceOf(AiGenerationException.class);
        server.verify();
    }

    @Test
    void aServerErrorRaisesAiGenerationExceptionWithNoDowngradeEvenIfBodyMentionsSchema() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withServerError()
                        .body("{\"error\":\"internal json_schema failure\"}")
                        .contentType(MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.generateUserStory("algo"))
                .isInstanceOf(AiGenerationException.class);
        server.verify();
    }

    @Test
    void parsesContentWrappedInMarkdownCodeFences() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withSuccess(
                        chatCompletion("```json\n" + VALID_STORY_JSON + "\n```"), MediaType.APPLICATION_JSON));

        GeneratedUserStoryResponse response = service.generateUserStory("algo");

        assertThat(response.userStory().action()).isEqualTo("exportar los datos a CSV");
        server.verify();
    }

    @Test
    void missingBenefitRaisesAiGenerationException() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withSuccess(chatCompletion(
                        "{\"userStory\":{\"role\":\"analista\",\"action\":\"exportar\"},"
                                + "\"acceptanceCriteria\":[\"un criterio\"]}"),
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.generateUserStory("algo"))
                .isInstanceOf(AiGenerationException.class);
        server.verify();
    }

    @Test
    void emptyAcceptanceCriteriaRaisesAiGenerationException() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withSuccess(chatCompletion(
                        "{\"userStory\":{\"role\":\"a\",\"action\":\"b\",\"benefit\":\"c\"},"
                                + "\"acceptanceCriteria\":[]}"),
                        MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.generateUserStory("algo"))
                .isInstanceOf(AiGenerationException.class);
        server.verify();
    }

    @Test
    void unparseableModelContentRaisesAiGenerationException() {
        server.expect(once(), requestTo("http://ollama.test/v1/chat/completions"))
                .andRespond(withSuccess(chatCompletion("no soy json, lo siento"), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> service.generateUserStory("algo"))
                .isInstanceOf(AiGenerationException.class);
        server.verify();
    }

    private String chatCompletion(String modelContent) {
        try {
            return json.writeValueAsString(Map.of(
                    "choices", List.of(Map.of("message", Map.of("role", "assistant", "content", modelContent)))));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
