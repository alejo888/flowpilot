package com.flowpilot.dto;

import com.flowpilot.entity.WorkItemPriority;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * {@code affectedItems} is populated ONLY by {@code PUT
 * /api/work-items/{id}/move} ({@link com.flowpilot.service.BoardService})
 * when the gap-based position strategy runs out of room and re-sequences
 * every sibling in the target column (design D10) — {@code null}/absent for
 * every other response (create/get/list/update) and for a move that didn't
 * trigger a resequence, so the frontend can tell "just the moved item
 * changed" apart from "these siblings also changed and need a local
 * refresh" without changing the shape of the common case.
 */
public record WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
        Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
        OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority, List<WorkItemResponse> affectedItems) {
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt, null, WorkItemPriority.MEDIUM, null);
    }
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt, Long sprintId) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt, sprintId, WorkItemPriority.MEDIUM, null);
    }
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
            OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt, sprintId, priority, null);
    }

    /** Returns a copy carrying the given {@code affectedItems} (see class javadoc). */
    public WorkItemResponse withAffectedItems(List<WorkItemResponse> affectedItems) {
        return new WorkItemResponse(id, projectId, columnId, title, description, assignedUserId, assignedUserName,
                position, createdAt, updatedAt, sprintId, priority, affectedItems);
    }
}
