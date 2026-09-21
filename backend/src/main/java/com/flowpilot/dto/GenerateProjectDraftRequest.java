package com.flowpilot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Free-text project description to turn into a project draft (vision 7.4).
 * Length-capped at 2000 characters; the text is treated purely as content to
 * analyse, never as instructions to the model.
 */
public record GenerateProjectDraftRequest(
        @NotBlank(message = "La descripción no puede estar vacía")
                @Size(max = 2000, message = "La descripción no puede superar los 2000 caracteres")
                String description) {}
