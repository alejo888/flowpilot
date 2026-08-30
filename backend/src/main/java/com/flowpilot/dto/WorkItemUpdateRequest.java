package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code acceptanceCriteria} replaces the stored ordered list wholesale;
 * {@code null}/omitted replaces it with {@code []} (spec: work-items —
 * "Update replaces criteria"). Provenance fields are create-only and are not
 * accepted here.
 */
public record WorkItemUpdateRequest(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description, Long assignedUserId,
        @Schema(nullable = true) Long sprintId, WorkItemPriority priority,
        List<String> acceptanceCriteria,
        @Schema(nullable = true) Long parentWorkItemId) {

    public WorkItemUpdateRequest {
        acceptanceCriteria = acceptanceCriteria == null ? List.of() : List.copyOf(acceptanceCriteria);
    }

    public WorkItemUpdateRequest(String title, String description, Long assignedUserId) {
        this(title, description, assignedUserId, null, null, List.of(), null);
    }

    public WorkItemUpdateRequest(String title, String description, Long assignedUserId, Long sprintId) {
        this(title, description, assignedUserId, sprintId, null, List.of(), null);
    }

    public WorkItemUpdateRequest(
            String title, String description, Long assignedUserId, Long sprintId, WorkItemPriority priority) {
        this(title, description, assignedUserId, sprintId, priority, List.of(), null);
    }
}
