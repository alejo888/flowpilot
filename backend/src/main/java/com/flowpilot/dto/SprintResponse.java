package com.flowpilot.dto;

import com.flowpilot.entity.SprintStatus;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record SprintResponse(
        Long id,
        Long projectId,
        String name,
        String goal,
        LocalDate startDate,
        LocalDate endDate,
        SprintStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}
