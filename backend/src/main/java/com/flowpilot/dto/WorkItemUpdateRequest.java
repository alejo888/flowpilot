package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WorkItemUpdateRequest(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description, Long assignedUserId, Long sprintId, WorkItemPriority priority) {
    public WorkItemUpdateRequest(String title, String description, Long assignedUserId) { this(title, description, assignedUserId, null, null); }
    public WorkItemUpdateRequest(String title, String description, Long assignedUserId, Long sprintId) { this(title, description, assignedUserId, sprintId, null); }
}
