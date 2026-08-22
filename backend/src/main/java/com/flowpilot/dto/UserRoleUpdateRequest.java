package com.flowpilot.dto;

import com.flowpilot.entity.GlobalRole;
import jakarta.validation.constraints.NotNull;

/** Body for {@code PUT /api/admin/users/{id}/role} (spec: user-administration). */
public record UserRoleUpdateRequest(@NotNull(message = "El rol no puede estar vacío") GlobalRole role) {
}
