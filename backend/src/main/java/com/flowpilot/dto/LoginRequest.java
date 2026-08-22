package com.flowpilot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "El email no puede estar vacío")
                @Email(message = "El email debe tener un formato válido")
                String email,
        @NotBlank(message = "La contraseña no puede estar vacía") String password) {
}
