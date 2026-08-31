package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Request body for {@code POST /api/projects/{projectId}/work-items/batch}
 * (spec: ai-subtask-generation — "Transactional batch work-item creation").
 *
 * <p>All-or-nothing: the endpoint is {@code @Transactional}, so a single
 * invalid line creates zero rows. {@code columnId} and {@code subtasks} are
 * required; {@code subtasks} must carry 1..10 lines. {@code parentWorkItemId},
 * {@code sprintId}, and the {@code aiGenerated}/{@code aiModel} provenance are
 * batch-level — one confirm action has one parent, one sprint, one
 * provenance, applied to every created row.
 */
public record WorkItemBatchCreateRequest(
        @NotNull(message = "La columna es obligatoria") Long columnId,
        @Schema(nullable = true) Long parentWorkItemId,
        @Schema(nullable = true) Long sprintId,
        @Schema(nullable = true) Boolean aiGenerated,
        @Schema(nullable = true) String aiModel,
        @NotEmpty(message = "Debes enviar al menos una subtarea")
        @Size(max = 10, message = "No se pueden crear más de 10 subtareas a la vez")
        @Valid List<BatchWorkItemLine> subtasks) {

    public WorkItemBatchCreateRequest {
        subtasks = subtasks == null ? List.of() : List.copyOf(subtasks);
    }
}
