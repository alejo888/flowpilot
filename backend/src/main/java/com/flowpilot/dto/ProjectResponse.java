package com.flowpilot.dto;

import com.flowpilot.entity.ProjectStatus;
import java.time.OffsetDateTime;

public record ProjectResponse(
        Long id,
        String name,
        String description,
        ProjectStatus status,
        Long ownerId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
