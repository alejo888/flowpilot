package com.flowpilot.dto;

import com.flowpilot.entity.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record ProjectMemberAddRequest(
        @NotNull Long userId,
        @NotNull ProjectRole role) {
}
