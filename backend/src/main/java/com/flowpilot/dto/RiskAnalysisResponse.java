package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A non-persisted hybrid risk analysis (vision 7.6): {@code signals} are
 * computed deterministically by the backend; {@code summary} and {@code
 * recommendations} are written by the AI provider over those signals only.
 * With no signals the AI is not called: {@code summary} is a fixed message,
 * {@code recommendations} is empty, {@code generatedBy} is {@link
 * AiProvider#STUB} and {@code model} is {@code null}.
 */
public record RiskAnalysisResponse(
        List<RiskSignalResponse> signals,
        String summary,
        List<String> recommendations,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
