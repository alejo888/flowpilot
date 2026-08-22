package com.flowpilot.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record CommentCreateRequest(@NotBlank @Size(max=4000) String content) {}
