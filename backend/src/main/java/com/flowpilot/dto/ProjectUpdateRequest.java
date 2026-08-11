package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;

public record ProjectUpdateRequest(
        @NotBlank String name,
        String description) {
}
