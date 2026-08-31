package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * One subtask line of a {@link WorkItemBatchCreateRequest}. Validated through
 * the {@code @Valid} cascade on the parent request, so a blank or over-long
 * title yields a per-index field path ({@code subtasks[i].title}) in the
 * Spanish 400 body — no custom code (spec: ai-subtask-generation —
 * "Transactional batch work-item creation").
 *
 * <p>{@code acceptanceCriteria} is copied defensively and never {@code null};
 * omitted is an empty list. {@code aiGenerated}/{@code aiModel} provenance is
 * batch-level, not per line — see {@link WorkItemBatchCreateRequest}.
 */
public record BatchWorkItemLine(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description,
        List<String> acceptanceCriteria,
        @Schema(nullable = true) Long assignedUserId,
        WorkItemPriority priority) {

    public BatchWorkItemLine {
        acceptanceCriteria = acceptanceCriteria == null ? List.of() : List.copyOf(acceptanceCriteria);
    }
}
