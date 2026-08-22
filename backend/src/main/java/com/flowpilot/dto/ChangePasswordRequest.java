package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "La contraseña actual no puede estar vacía") String currentPassword,
        @NotBlank(message = "La contraseña no puede estar vacía")
                @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
                String newPassword) {
}
