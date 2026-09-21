package com.flowpilot.service;

import com.flowpilot.dto.RiskSeverity;
import com.flowpilot.dto.RiskSignalResponse;
import java.util.List;

/**
 * Backend-side composition of the AI risk context (vision 7.6), in the same
 * spirit as {@link AiStoryContext}: Spanish labels, and the provider only
 * ever receives this text as content. It is built from the deterministic
 * signals alone — the model never sees raw project data and cannot invent
 * risks that were not detected.
 */
final class AiRiskContext {

    private AiRiskContext() {}

    static String compose(List<RiskSignalResponse> signals) {
        StringBuilder context = new StringBuilder("Señales de riesgo detectadas (" + signals.size() + "):");
        for (RiskSignalResponse signal : signals) {
            context.append("\n- [")
                    .append(severityLabel(signal.severity()))
                    .append("] ")
                    .append(signal.title())
                    .append(": ")
                    .append(signal.detail());
        }
        return context.toString();
    }

    private static String severityLabel(RiskSeverity severity) {
        return switch (severity) {
            case HIGH -> "ALTA";
            case MEDIUM -> "MEDIA";
            case LOW -> "BAJA";
        };
    }
}
