package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * What the AI seam returns for a risk analysis (vision 7.6): a short summary
 * and 1..6 recommendations written over the deterministic signals. Internal to
 * the service layer; the public contract is {@link RiskAnalysisResponse}, which
 * adds the signals. {@code model} is {@code null} for a {@link AiProvider#STUB} result.
 */
public record GeneratedRiskAdvice(
        String summary,
        List<String> recommendations,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
