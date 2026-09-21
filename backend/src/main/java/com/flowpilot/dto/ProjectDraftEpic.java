package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** An epic proposed in a project draft, with its 1..6 stories (vision 7.4). Non-persisted. */
public record ProjectDraftEpic(
        String title, @Schema(nullable = true) String description, List<ProjectDraftStory> stories) {}
