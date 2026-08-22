package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Update payload for {@code PUT /api/work-items/{id}}. Deliberately excludes
 * {@code columnId}/{@code position} — those are mutated only by the slice-6
 * move endpoint ({@code PUT /api/work-items/{id}/move}), not this one.
 */
public record WorkItemUpdateRequest(
        @NotBlank(message = "El título no puede estar vacío") String title,
        String description,
        Long assignedUserId,
        Long sprintId) {

    public WorkItemUpdateRequest(String title, String description, Long assignedUserId) {
        this(title, description, assignedUserId, null);
    }
}
