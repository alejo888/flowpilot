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
 *
 * <p>{@code acceptanceCriteria} is the item's ordered criteria list (empty
 * when none were set); {@code aiGenerated}/{@code aiModel} are client-asserted
 * provenance (spec: work-items — "Structured acceptance criteria", "AI
 * provenance on confirmed create").
 *
 * <p>{@code parentWorkItemId}/{@code parentWorkItemTitle} describe the item's
 * single-level parent link (spec: work-item-hierarchy); {@code childCount} is
 * the number of direct subtasks ({@code 0} when none). A move response MAY
 * carry {@code parentWorkItemTitle == null} and {@code childCount == 0} even
 * for an item that has a parent/children — those two paths are derived only
 * by the CRUD/list paths (design D4).
 */
public record WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
        Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
        OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority, List<WorkItemResponse> affectedItems,
        List<String> acceptanceCriteria, boolean aiGenerated, String aiModel,
        Long parentWorkItemId, String parentWorkItemTitle, long childCount) {

    public WorkItemResponse {
        acceptanceCriteria = acceptanceCriteria == null ? List.of() : acceptanceCriteria;
    }

    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt,
                null, WorkItemPriority.MEDIUM, null, List.of(), false, null, null, null, 0);
    }
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt, OffsetDateTime updatedAt, Long sprintId) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt,
                sprintId, WorkItemPriority.MEDIUM, null, List.of(), false, null, null, null, 0);
    }
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
            OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt,
                sprintId, priority, null, List.of(), false, null, null, null, 0);
    }

    /** Full response for create/get/list/update — no {@code affectedItems}, provenance and criteria included. */
    public WorkItemResponse(Long id, Long projectId, Long columnId, String title, String description,
            Long assignedUserId, String assignedUserName, int position, OffsetDateTime createdAt,
            OffsetDateTime updatedAt, Long sprintId, WorkItemPriority priority,
            List<String> acceptanceCriteria, boolean aiGenerated, String aiModel) {
        this(id, projectId, columnId, title, description, assignedUserId, assignedUserName, position, createdAt, updatedAt,
                sprintId, priority, null, acceptanceCriteria, aiGenerated, aiModel, null, null, 0);
    }

    /** Returns a copy carrying the given {@code affectedItems} (see class javadoc). */
    public WorkItemResponse withAffectedItems(List<WorkItemResponse> affectedItems) {
        return new WorkItemResponse(id, projectId, columnId, title, description, assignedUserId, assignedUserName,
                position, createdAt, updatedAt, sprintId, priority, affectedItems, acceptanceCriteria, aiGenerated, aiModel,
                parentWorkItemId, parentWorkItemTitle, childCount);
    }
}
