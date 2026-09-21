package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** A story proposed under an epic in a project draft (vision 7.4). Non-persisted. */
public record ProjectDraftStory(String title, @Schema(nullable = true) String description) {}
