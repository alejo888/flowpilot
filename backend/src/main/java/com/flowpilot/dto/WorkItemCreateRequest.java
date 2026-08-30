package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code acceptanceCriteria} is an ordered list persisted verbatim to the
 * {@code acceptance_criteria jsonb} column — optional, {@code null}/omitted is
 * stored as {@code []}, never folded into {@code description} (spec:
 * work-items — "Structured acceptance criteria").
 *
 * <p>{@code aiGenerated}/{@code aiModel} are client-asserted provenance
 * (design D4): set only when confirming an AI draft. {@code aiGenerated} is a
 * {@link Boolean} wrapper so an omitted field is {@code null} (stored as
 * {@code false}) rather than a required property in the generated contract.
 */
public record WorkItemCreateRequest(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description, Long assignedUserId,
        @Schema(nullable = true) Long sprintId, WorkItemPriority priority,
        List<String> acceptanceCriteria,
        @Schema(nullable = true) Boolean aiGenerated,
        @Schema(nullable = true) String aiModel) {

    public WorkItemCreateRequest {
        acceptanceCriteria = acceptanceCriteria == null ? List.of() : List.copyOf(acceptanceCriteria);
    }

    public WorkItemCreateRequest(String title, String description, Long assignedUserId) {
        this(title, description, assignedUserId, null, null, List.of(), null, null);
    }

    public WorkItemCreateRequest(String title, String description, Long assignedUserId, Long sprintId) {
        this(title, description, assignedUserId, sprintId, null, List.of(), null, null);
    }

    public WorkItemCreateRequest(
            String title, String description, Long assignedUserId, Long sprintId, WorkItemPriority priority) {
        this(title, description, assignedUserId, sprintId, priority, List.of(), null, null);
    }
}
