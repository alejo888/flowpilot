package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One story line of a {@link BacklogEpicRequest}; created as a child work item of its epic. */
public record BacklogStoryRequest(
        @NotBlank(message = "El título no puede estar vacío")
        @Size(max = 255, message = "El título no puede superar los 255 caracteres") String title,
        String description) {}
