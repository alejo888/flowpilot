package com.flowpilot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
        @NotBlank(message = "El email no puede estar vacío")
                @Email(message = "El email debe tener un formato válido")
                String email) {
}
