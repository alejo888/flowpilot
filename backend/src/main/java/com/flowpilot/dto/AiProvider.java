package com.flowpilot.dto;

/**
 * Which provider produced a user-story draft (spec: ai-user-story-generation).
 * {@code STUB} is the deterministic offline generator active when {@code
 * flowpilot.ai.enabled=false}; {@code OLLAMA} is the local LLM active when it
 * is {@code true}.
 */
public enum AiProvider {
    STUB,
    OLLAMA
}
