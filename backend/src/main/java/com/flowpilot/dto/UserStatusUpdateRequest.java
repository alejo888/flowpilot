package com.flowpilot.dto;

import jakarta.validation.constraints.NotNull;

/** Body for {@code PATCH /api/admin/users/{id}/status} (spec: user-administration). */
public record UserStatusUpdateRequest(@NotNull(message = "El estado no puede estar vacío") Boolean active) {
}
