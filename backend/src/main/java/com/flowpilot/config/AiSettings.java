package com.flowpilot.config;

/**
 * The single source of the {@code flowpilot.ai.enabled} flag for non-config
 * consumers (spec: ai-runtime-config — "Expose AI availability"). {@link
 * AiConfig} builds this bean from the one {@code @Value} lookup so callers such
 * as {@link com.flowpilot.controller.AiConfigController} never re-read the
 * property themselves — there is exactly one place the flag is resolved.
 */
public record AiSettings(boolean enabled) {}
