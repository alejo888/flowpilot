package com.flowpilot.dto;

/**
 * Lightweight user-directory projection for member selection (spec:
 * user-directory). Deliberately excludes {@code passwordHash}, {@code role},
 * {@code active}, and any other sensitive/internal field.
 */
public record UserSummaryResponse(Long id, String name, String email) {
}
