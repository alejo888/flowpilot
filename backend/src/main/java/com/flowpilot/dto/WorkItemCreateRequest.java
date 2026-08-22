package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import jakarta.validation.constraints.NotBlank;

public record WorkItemCreateRequest(@NotBlank(message = "El título no puede estar vacío") String title,
        String description, Long assignedUserId, Long sprintId, WorkItemPriority priority) {
    public WorkItemCreateRequest(String title, String description, Long assignedUserId) { this(title, description, assignedUserId, null, null); }
    public WorkItemCreateRequest(String title, String description, Long assignedUserId, Long sprintId) { this(title, description, assignedUserId, sprintId, null); }
}
