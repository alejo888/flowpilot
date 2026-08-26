package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ProjectCreateRequest(
        @NotBlank(message = "El nombre no puede estar vacío")
        @Size(max = 255, message = "El nombre no puede superar los 255 caracteres") String name,
        String description,
        @Size(max = 50, message = "El código no puede superar los 50 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9_-]*$",
                message = "El código solo puede contener letras, dígitos, guion y guion bajo") String code,
        LocalDate startDate,
        LocalDate estimatedEndDate,
        @Size(max = 1000, message = "Las tecnologías no pueden superar los 1000 caracteres") String technologies,
        @Size(max = 500, message = "La URL del repositorio no puede superar los 500 caracteres")
        @Pattern(regexp = "^$|^https?://\\S+$",
                message = "La URL del repositorio debe comenzar con http:// o https://") String repositoryUrl) {
}
