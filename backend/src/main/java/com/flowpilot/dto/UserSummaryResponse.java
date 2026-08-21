package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Lightweight user-directory projection for member selection (spec:
 * user-directory). Deliberately excludes {@code passwordHash}, {@code role},
 * {@code active}, and any other sensitive/internal field.
 */
public record UserSummaryResponse(Long id, String name, @Schema(format = "email") String email) {
}
