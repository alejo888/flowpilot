package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A non-persisted list of 1..8 acceptance criteria (spec:
 * ai-acceptance-criteria-generation — PR 1). Mirrors {@link
 * GeneratedSubtasksResponse}: {@code model} is the Ollama model name for an
 * {@link AiProvider#OLLAMA} result and {@code null} for a {@link
 * AiProvider#STUB} result. An empty model result raises {@code
 * AiGenerationException} instead of yielding an empty list.
 */
public record GeneratedAcceptanceCriteriaResponse(
        List<String> criteria,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
