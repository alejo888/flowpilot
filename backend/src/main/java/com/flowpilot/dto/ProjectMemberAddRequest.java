package com.flowpilot.dto;

import com.flowpilot.entity.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record ProjectMemberAddRequest(
        @NotNull(message = "El usuario no puede estar vacío") Long userId,
        @NotNull(message = "El rol no puede estar vacío") ProjectRole role) {
}
