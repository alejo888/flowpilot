package com.flowpilot.dto;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

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
        String repositoryUrl,
        /**
         * The permissions the CALLER holds for THIS project (not the full
         * catalog, not another role's grants) — lets the frontend gate
         * destructive/mutating controls proactively instead of discovering a
         * lack of permission only via a 403.
         */
        Set<Permission> callerPermissions) {
}
