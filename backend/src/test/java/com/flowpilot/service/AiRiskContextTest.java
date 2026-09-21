package com.flowpilot.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.flowpilot.dto.RiskSeverity;
import com.flowpilot.dto.RiskSignalResponse;
import com.flowpilot.dto.RiskSignalType;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Spanish AI context built from the deterministic signals only (vision 7.6). */
class AiRiskContextTest {

    @Test
    void composesACountHeaderAndOneLinePerSignalWithSpanishSeverity() {
        String context = AiRiskContext.compose(List.of(
                new RiskSignalResponse(
                        RiskSignalType.SPRINT_OVERDUE, RiskSeverity.HIGH, "Sprint vencido", "Terminó ayer.", null, null),
                new RiskSignalResponse(
                        RiskSignalType.STALLED_ITEM, RiskSeverity.MEDIUM, "Tarea estancada", "Sin cambios.", 4L, null),
                new RiskSignalResponse(
                        RiskSignalType.LARGE_STORY, RiskSeverity.LOW, "Historia grande", "5 subtareas.", 9L, null)));

        assertThat(context)
                .isEqualTo("Señales de riesgo detectadas (3):\n"
                        + "- [ALTA] Sprint vencido: Terminó ayer.\n"
                        + "- [MEDIA] Tarea estancada: Sin cambios.\n"
                        + "- [BAJA] Historia grande: 5 subtareas.");
    }
}
