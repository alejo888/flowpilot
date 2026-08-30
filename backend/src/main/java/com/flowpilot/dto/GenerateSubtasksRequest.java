package com.flowpilot.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;

/**
 * Input for {@code POST /api/projects/{projectId}/ai/subtasks} (spec:
 * ai-subtask-generation — PR 1). Exactly one of {@code workItemId} (mode a: an
 * existing story in the project) XOR {@code storyText} (mode b: pasted text)
 * must be present. Both-present and both-absent both fail bean validation and
 * ride the existing {@code MethodArgumentNotValidException} → Spanish 400 path
 * (design D3), so no new exception type is needed.
 *
 * <p>The {@code isExactlyOneInput} accessor is {@code @JsonIgnore} +
 * {@code @Schema(hidden = true)} so it never phantoms into the generated
 * OpenAPI schema.
 */
public record GenerateSubtasksRequest(
        @Schema(nullable = true) Long workItemId,
        @Schema(nullable = true)
                @Size(max = 4000, message = "El texto no puede superar los 4000 caracteres")
                String storyText) {

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "Indica una tarea existente O un texto libre, pero no ambos")
    public boolean isExactlyOneInput() {
        return (workItemId != null) ^ (storyText != null && !storyText.isBlank());
    }
}
