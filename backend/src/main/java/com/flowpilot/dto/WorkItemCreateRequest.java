package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Create payload for {@code POST /api/projects/{id}/work-items}. No {@code
 * columnId} — per spec, a new item always lands in the project's first
 * seeded column (slice 5). Moving between columns is the slice-6 endpoint.
 */
public record WorkItemCreateRequest(
        @NotBlank String title,
        String description,
        Long assignedUserId) {
}
