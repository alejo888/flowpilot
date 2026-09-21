package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.dto.AiProvider;
import com.flowpilot.dto.GeneratedRiskAdvice;
import org.junit.jupiter.api.Test;

/** Stub risk advice (vision 7.6): deterministic, offline, {@code model=null}. */
class StubAiPlanningServiceRiskTest {

    private final StubAiPlanningService service = new StubAiPlanningService();

    @Test
    void analyzeRisksReturnsADeterministicStubAdviceWithNoModel() {
        GeneratedRiskAdvice first = service.analyzeRisks("Señales detectadas (1):\n- [ALTA] X: y");
        GeneratedRiskAdvice second = service.analyzeRisks("Señales detectadas (1):\n- [ALTA] X: y");

        assertThat(first.generatedBy()).isEqualTo(AiProvider.STUB);
        assertThat(first.model()).isNull();
        assertThat(first.summary()).isNotBlank();
        assertThat(first.recommendations()).hasSizeBetween(1, 6).allSatisfy(r -> assertThat(r).isNotBlank());
        assertThat(first).isEqualTo(second);
    }

    @Test
    void analyzeRisksMentionsTheNumberOfSignalsWhenTheContextStatesIt() {
        assertThat(service.analyzeRisks("Señales detectadas (3):\n- a\n- b\n- c").summary()).contains("3");
    }
}
