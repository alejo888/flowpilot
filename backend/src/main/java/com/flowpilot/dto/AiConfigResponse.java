package com.flowpilot.dto;

/**
 * Reports whether AI-assisted planning is enabled (spec: ai-runtime-config —
 * "Expose AI availability"). Mirrors the {@code flowpilot.ai.enabled} flag; the
 * frontend uses it to show or hide the AI user-story entrypoint.
 */
public record AiConfigResponse(boolean enabled) {}
