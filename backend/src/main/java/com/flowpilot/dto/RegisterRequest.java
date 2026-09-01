package com.flowpilot.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "El nombre no puede estar vacío") String name,
        @NotBlank(message = "El email no puede estar vacío")
                @Email(message = "El email debe tener un formato válido")
                @Pattern(
                        regexp = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
                        message = "El email debe tener un formato válido")
                String email,
        @NotBlank(message = "La contraseña no puede estar vacía")
                @Size(min = 8, max = 72, message = "La contraseña debe tener entre 8 y 72 caracteres")
                String password) {
}
