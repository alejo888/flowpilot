package com.flowpilot.dto;

import com.flowpilot.entity.ProjectStatus;
import jakarta.validation.constraints.NotNull;

public record ProjectStatusUpdateRequest(
        @NotNull ProjectStatus status) {
}
