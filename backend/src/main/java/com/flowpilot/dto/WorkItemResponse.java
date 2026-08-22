package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import java.time.OffsetDateTime;

public record WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
        Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
        OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority) {
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt, null, WorkItemPriority.MEDIUM);
    }
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt, Long sprintId) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt, sprintId, WorkItemPriority.MEDIUM);
    }
}
