package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * A non-persisted user-story draft (spec: ai-user-story-generation). Nothing
 * is written when this is returned — the caller edits the draft and confirms
 * it via {@code POST /api/projects/{projectId}/work-items}.
 *
 * <p>{@code model} is the Ollama model name for an {@link AiProvider#OLLAMA}
 * draft and {@code null} for a {@link AiProvider#STUB} draft.
 */
public record GeneratedUserStoryResponse(
        UserStoryDraft userStory,
        List<String> acceptanceCriteria,
        AiProvider generatedBy,
        @Schema(nullable = true) String model) {}
