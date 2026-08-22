package com.flowpilot.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record CommentUpdateRequest(@NotBlank @Size(max=4000) String content) {}
