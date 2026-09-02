package com.flowpilot.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Input for {@code POST /api/projects/{projectId}/ai/acceptance-criteria}
 * (spec: ai-acceptance-criteria-generation — PR 1). The generation target is
 * always an existing work item (design D5), so {@code workItemId} is the only
 * field and is required and non-nullable — there is no free-text mode and no
 * {@code @AssertTrue} cross-field trap. The generic record name leaves room
 * for a future nullable {@code storyText} as an additive, oasdiff-safe change.
 *
 * <p>A missing {@code workItemId} rides the existing {@code
 * MethodArgumentNotValidException} → Spanish 400 path, so no new exception
 * type is needed.
 */
public record GenerateAcceptanceCriteriaRequest(
        @NotNull(message = "La tarea es obligatoria") Long workItemId) {}
