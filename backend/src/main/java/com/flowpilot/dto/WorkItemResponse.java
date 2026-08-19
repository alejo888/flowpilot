package com.flowpilot.dto;

import java.time.OffsetDateTime;

public record WorkItemResponse(
        Long id,
        Long projectId,
        Long columnId,
        String title,
        String description,
        Long assignedUserId,
        String assignedUserName,
        int position,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
