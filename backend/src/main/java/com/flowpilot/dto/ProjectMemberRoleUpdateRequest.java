package com.flowpilot.dto;

import com.flowpilot.entity.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record ProjectMemberRoleUpdateRequest(
        @NotNull ProjectRole role) {
}
