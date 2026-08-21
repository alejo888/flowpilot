package com.flowpilot.dto;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/** One (role, permission) grant cell (spec: role-permissions). */
public record RolePermissionGrant(
        @NotNull ProjectRole role,
        @NotNull Permission permission,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean granted) {
}
