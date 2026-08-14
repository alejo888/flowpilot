package com.flowpilot.dto;

import com.flowpilot.entity.ProjectStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ProjectResponse(
        Long id,
        String name,
        String description,
        ProjectStatus status,
        Long ownerId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String code,
        LocalDate startDate,
        LocalDate estimatedEndDate,
        String technologies,
        String repositoryUrl) {
}
