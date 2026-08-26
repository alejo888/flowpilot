package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record SprintUpdateRequest(
        @NotBlank(message = "El nombre no puede estar vacío")
        @Size(max = 255, message = "El nombre no puede superar los 255 caracteres") String name,
        String goal,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate) {}
