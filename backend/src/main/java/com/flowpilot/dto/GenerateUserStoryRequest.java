package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Free-text requirement to turn into a user story (spec:
 * ai-user-story-generation — "Generate non-persisted user-story draft").
 * Length-capped at 2000 characters; the text is treated purely as content to
 * analyse, never as instructions to the model.
 */
public record GenerateUserStoryRequest(
        @NotBlank(message = "El requisito no puede estar vacío")
                @Size(max = 2000, message = "El requisito no puede superar los 2000 caracteres")
                String requirement) {}
