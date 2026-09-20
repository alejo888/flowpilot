package com.flowpilot.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.flowpilot.service.AiPlanningService;
import com.flowpilot.service.OllamaAiPlanningService;
import com.flowpilot.service.StubAiPlanningService;
import org.junit.jupiter.api.Test;

/**
 * Pins the single wiring decision in {@link AiConfig} (design D1/D2): the
 * factory is total by construction — it always returns exactly one {@link
 * AiPlanningService}, the stub when disabled and the Ollama client when
 * enabled, and it fails context startup fast when enabled without the
 * required Ollama base URL and model. Exercised as a plain method, no Spring
 * context.
 */
class AiConfigTest {

    private final AiConfig config = new AiConfig();

    @Test
    void returnsTheStubWhenDisabled() {
        AiPlanningService service = config.aiPlanningService(false, "ollama", "", "");

        assertThat(service).isInstanceOf(StubAiPlanningService.class);
    }

    @Test
    void returnsTheStubWhenDisabledEvenIfOllamaPropsAreSet() {
        AiPlanningService service =
                config.aiPlanningService(false, "ollama", "http://localhost:11434", "llama3");

        assertThat(service).isInstanceOf(StubAiPlanningService.class);
    }

    @Test
    void failsFastWhenEnabledWithBlankBaseUrl() {
        assertThatThrownBy(() -> config.aiPlanningService(true, "ollama", "   ", "llama3"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("base-url");
    }

    @Test
    void failsFastWhenEnabledWithBlankModel() {
        assertThatThrownBy(() -> config.aiPlanningService(true, "ollama", "http://localhost:11434", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("model");
    }

    @Test
    void returnsTheOllamaClientWhenEnabledAndConfigured() {
        AiPlanningService service =
                config.aiPlanningService(true, "ollama", "http://localhost:11434", "llama3");

        assertThat(service).isInstanceOf(OllamaAiPlanningService.class);
    }

    @Test
    void returnsTheStubWhenEnabledWithStubProviderAndNoOllamaProps() {
        AiPlanningService service = config.aiPlanningService(true, "stub", "", "");

        assertThat(service).isInstanceOf(StubAiPlanningService.class);
    }

    @Test
    void providerValueIsCaseAndWhitespaceTolerant() {
        assertThat(config.aiPlanningService(true, "STUB", "", ""))
                .isInstanceOf(StubAiPlanningService.class);
        assertThat(config.aiPlanningService(true, " stub ", "", ""))
                .isInstanceOf(StubAiPlanningService.class);
        assertThat(config.aiPlanningService(true, " OLLAMA ", "http://localhost:11434", "llama3"))
                .isInstanceOf(OllamaAiPlanningService.class);
    }

    @Test
    void blankProviderCountsAsOllama() {
        assertThatThrownBy(() -> config.aiPlanningService(true, "  ", "", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("base-url");
    }

    @Test
    void ollamaProviderStillRequiresOllamaProps() {
        assertThatThrownBy(() -> config.aiPlanningService(true, "ollama", "", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("base-url");
    }

    @Test
    void failsFastWhenEnabledWithUnknownProvider() {
        assertThatThrownBy(
                        () -> config.aiPlanningService(true, "openai", "http://localhost:11434", "llama3"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("flowpilot.ai.provider")
                .hasMessageContaining("openai");
    }

    @Test
    void disabledIgnoresTheProviderEvenIfUnknown() {
        AiPlanningService service = config.aiPlanningService(false, "openai", "", "");

        assertThat(service).isInstanceOf(StubAiPlanningService.class);
    }

    @Test
    void aiSettingsBeanCarriesTheEnabledFlagVerbatim() {
        assertThat(config.aiSettings(true).enabled()).isTrue();
        assertThat(config.aiSettings(false).enabled()).isFalse();
    }
}
