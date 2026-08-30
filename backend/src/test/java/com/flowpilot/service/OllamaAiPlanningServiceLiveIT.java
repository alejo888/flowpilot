package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedUserStoryResponse;
import java.time.Duration;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Opt-in live check against a real local Ollama — the one test in this module
 * that makes an actual outbound LLM call. Disabled by default, exactly like the
 * Testcontainers-backed integration tests are excluded from a Docker-less run
 * (see {@code CLAUDE.md} "Integration tests ... won't run in a Docker-less
 * sandbox"); this one additionally needs a running model server, so it never
 * runs in CI and stays {@link Disabled} in the committed tree.
 *
 * <p><strong>To run it manually:</strong>
 *
 * <ol>
 *   <li>Install and start Ollama: {@code ollama serve} (listens on
 *       {@code http://localhost:11434}).</li>
 *   <li>Pull a model, e.g. {@code ollama pull llama3}.</li>
 *   <li>Point the test at that model if it is not {@code llama3}:
 *       {@code export FLOWPILOT_AI_OLLAMA_MODEL=<name>}.</li>
 *   <li>Delete the {@link Disabled} annotation below (or run this single method
 *       from your IDE, which ignores it) and execute
 *       {@code ./mvnw test -Dtest=OllamaAiPlanningServiceLiveIT}.</li>
 * </ol>
 *
 * <p>It asserts the real round trip: a free-text Spanish requirement comes back
 * as a backend-composed {@code "Como ... quiero ... para ..."} sentence with at
 * least one acceptance criterion and {@code generatedBy == OLLAMA}. Everything
 * offline-verifiable about the wire shape, the {@code json_object} downgrade,
 * the no-retry contract and the error mapping is covered by {@link
 * OllamaAiPlanningServiceTest} with {@code MockRestServiceServer}.
 */
@Disabled("Live Ollama integration — opt-in only. Requires a local `ollama serve` + a pulled model. "
        + "See the class Javadoc for the manual run recipe.")
class OllamaAiPlanningServiceLiveIT {

    private static final String BASE_URL = System.getenv()
            .getOrDefault("FLOWPILOT_AI_OLLAMA_BASE_URL", "http://localhost:11434");
    private static final String MODEL = System.getenv()
            .getOrDefault("FLOWPILOT_AI_OLLAMA_MODEL", "llama3");

    @Test
    void generatesARealUserStoryFromALocalOllama() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(60));
        RestClient restClient = RestClient.builder().baseUrl(BASE_URL).requestFactory(factory).build();
        ObjectMapper lenient =
                new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        OllamaAiPlanningService service = new OllamaAiPlanningService(restClient, MODEL, lenient);

        GeneratedUserStoryResponse response = service.generateUserStory(
                "Como responsable de proyecto necesito exportar el tablero a PDF para compartirlo con "
                        + "clientes que no usan la herramienta.");

        assertThat(response.generatedBy()).isEqualTo(AiProvider.OLLAMA);
        assertThat(response.model()).isEqualTo(MODEL);
        assertThat(response.userStory().text()).startsWith("Como ").contains(" quiero ").contains(" para ");
        assertThat(response.acceptanceCriteria()).isNotEmpty();
        assertThat(response.acceptanceCriteria()).allSatisfy(c -> assertThat(c).isNotBlank());
    }
}
