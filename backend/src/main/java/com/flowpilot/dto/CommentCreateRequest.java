package com.flowpilot.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record CommentCreateRequest(
        @NotBlank(message = "El contenido no puede estar vacío")
        @Size(max = 4000, message = "El contenido no puede superar los 4000 caracteres") String content) {}
