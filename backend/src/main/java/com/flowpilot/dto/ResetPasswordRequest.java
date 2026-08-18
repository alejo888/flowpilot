package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "El token no puede estar vacío") String token,
        @NotBlank(message = "La contraseña no puede estar vacía")
                @Size(min = 8, message = "La contraseña debe tener al menos 8 caracteres")
                String newPassword) {
}
