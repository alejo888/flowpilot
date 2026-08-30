package com.flowpilot.dto;

/**
 * The parts of a generated user story plus the backend-composed Spanish
 * sentence (spec: ai-user-story-generation). {@code text} is always {@code
 * "Como " + role + " quiero " + action + " para " + benefit} — the model
 * supplies only {@code role}/{@code action}/{@code benefit}, never the
 * assembled sentence.
 */
public record UserStoryDraft(String role, String action, String benefit, String text) {}
