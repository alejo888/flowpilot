package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A non-persisted list of subtask drafts (spec: ai-subtask-generation — PR 1).
 * Mirrors {@link GeneratedUserStoryResponse}: {@code model} is the Ollama model
 * name for an {@link AiProvider#OLLAMA} result and {@code null} for a {@link
 * AiProvider#STUB} result. The list always carries 1..10 items — an empty model
 * result raises {@code AiGenerationException} instead.
 */
public record GeneratedSubtasksResponse(
        List<SubtaskDraft> subtasks,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
