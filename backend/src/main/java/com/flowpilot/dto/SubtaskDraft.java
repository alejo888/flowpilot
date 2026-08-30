package com.flowpilot.dto;

/**
 * A single non-persisted subtask draft (spec: ai-subtask-generation — PR 1).
 * The caller edits the list and confirms it through the batch work-item
 * endpoint; nothing is written when this is returned. {@code description} is
 * never {@code null} — an absent model description becomes {@code ""}.
 */
public record SubtaskDraft(String title, String description) {}
