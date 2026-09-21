package com.flowpilot.dto;

/** Kind of deterministic project-risk signal detected by the backend (vision 7.6). */
public enum RiskSignalType {
    LARGE_STORY,
    OVERLOADED_MEMBER,
    SPRINT_AT_RISK,
    SPRINT_OVERDUE,
    STALLED_ITEM,
    UNASSIGNED_HIGH_PRIORITY
}
