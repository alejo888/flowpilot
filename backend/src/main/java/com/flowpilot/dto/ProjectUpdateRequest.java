package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ProjectUpdateRequest(
        @NotBlank String name,
        String description,
        @Size(max = 50) @Pattern(regexp = "^[A-Za-z0-9_-]*$",
                message = "Code may only contain letters, digits, hyphen and underscore") String code,
        LocalDate startDate,
        LocalDate estimatedEndDate,
        @Size(max = 1000) String technologies,
        @Size(max = 500) @Pattern(regexp = "^$|^https?://\\S+$",
                message = "Repository URL must start with http:// or https://") String repositoryUrl) {
}
