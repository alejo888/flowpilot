package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One deterministic risk signal (vision 7.6). {@code title} and {@code detail}
 * are Spanish, backend-authored text; {@code workItemId} / {@code userId} point
 * at the affected entity when there is a single one (both are {@code null} for
 * sprint-level signals).
 */
public record RiskSignalResponse(
        RiskSignalType type,
        RiskSeverity severity,
        String title,
        String detail,
        @Schema(nullable = true) Long workItemId,
        @Schema(nullable = true) Long userId) {}
