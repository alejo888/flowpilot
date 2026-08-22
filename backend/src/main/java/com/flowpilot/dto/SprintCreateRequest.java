package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record SprintCreateRequest(
        @NotBlank String name,
        String goal,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate) {}
