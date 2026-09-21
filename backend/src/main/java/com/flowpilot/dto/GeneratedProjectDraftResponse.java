package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A non-persisted project draft (vision 7.4): project name, description and
 * technologies plus 1..6 epics, each with 1..6 stories. Nothing is written when
 * this is returned. It carries no {@code code} and no dates — the user may add
 * them before confirming. {@code model} is the Ollama model name for an {@link
 * AiProvider#OLLAMA} draft and {@code null} for a {@link AiProvider#STUB} draft.
 */
public record GeneratedProjectDraftResponse(
        String name,
        String description,
        @Schema(nullable = true) String technologies,
        List<ProjectDraftEpic> epics,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
