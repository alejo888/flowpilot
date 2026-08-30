package com.flowpilot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A single-type "Tarea" task scoped to a {@link Project} (spec: work-items;
 * confirmed decision 4 — no {@code type} column, one implicit type in MVP).
 * References a {@link BoardColumn} via {@code columnId} rather than a status
 * enum (confirmed decision 9). {@code position} is the item's within-column
 * ordering, using the same gap-based strategy as {@code BoardColumn.position}
 * (design D10): new items start at {@code max(position in column) + 1024}, or
 * {@code 1024} if the column is empty. The move endpoint that mutates {@code
 * columnId}/{@code position} together is slice 6 (Kanban board) — this slice
 * only creates items into the project's first column and never changes either
 * field after creation.
 *
 * <p>{@code version} (V16 migration) backs JPA's built-in optimistic locking,
 * same convention as {@code Project}/{@code ProjectMember}: two concurrent
 * writes to the same row now fail the second with a 409 instead of silently
 * last-write-wins.
 */
@Entity
@Table(name = "work_items")
public class WorkItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "column_id", nullable = false)
    private Long columnId;

    @Column(nullable = false)
    private String title;

    @Column
    private String description;

    @Column(name = "assigned_user_id")
    private Long assignedUserId;

    @Column(name = "sprint_id")
    private Long sprintId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WorkItemPriority priority;

    @Column(nullable = false)
    private int position;

    /**
     * Ordered acceptance criteria (spec: work-items — "Structured acceptance
     * criteria"). Persisted to {@code acceptance_criteria jsonb NOT NULL
     * DEFAULT '[]'} through {@link AcceptanceCriteriaConverter}; never folded
     * into {@code description}. Always a non-null list — empty when none set.
     */
    @Convert(converter = AcceptanceCriteriaConverter.class)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "acceptance_criteria", columnDefinition = "jsonb", nullable = false)
    private List<String> acceptanceCriteria = new ArrayList<>();

    /**
     * Client-asserted provenance (design D4): {@code true} only when the item
     * was created from a confirmed AI draft. Not a server-verifiable audit
     * control — records what the client claims.
     */
    @Column(name = "ai_generated", nullable = false)
    private boolean aiGenerated = false;

    /** Model name for an AI-generated item; {@code null} for manual creation or a STUB draft. */
    @Column(name = "ai_model", length = 120)
    private String aiModel;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected WorkItem() {
        // JPA
    }

    public WorkItem(
            Long projectId, Long columnId, String title, String description, Long assignedUserId, int position) {
        this(projectId, columnId, title, description, assignedUserId, position, null, WorkItemPriority.MEDIUM);
    }

    public WorkItem(
            Long projectId,
            Long columnId,
            String title,
            String description,
            Long assignedUserId,
            int position,
            Long sprintId) {
        this(projectId, columnId, title, description, assignedUserId, position, sprintId, WorkItemPriority.MEDIUM);
    }

    public WorkItem(
            Long projectId,
            Long columnId,
            String title,
            String description,
            Long assignedUserId,
            int position,
            Long sprintId,
            WorkItemPriority priority) {
        this.projectId = projectId;
        this.columnId = columnId;
        this.title = title;
        this.description = description;
        this.assignedUserId = assignedUserId;
        this.position = position;
        this.sprintId = sprintId;
        this.priority = priority == null ? WorkItemPriority.MEDIUM : priority;
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public Long getColumnId() {
        return columnId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Long getAssignedUserId() {
        return assignedUserId;
    }

    public void setAssignedUserId(Long assignedUserId) {
        this.assignedUserId = assignedUserId;
    }

    public Long getSprintId() {
        return sprintId;
    }

    public void setSprintId(Long sprintId) {
        this.sprintId = sprintId;
    }

    public WorkItemPriority getPriority() {
        return priority;
    }

    public void setPriority(WorkItemPriority priority) {
        this.priority = priority == null ? WorkItemPriority.MEDIUM : priority;
    }

    public int getPosition() {
        return position;
    }

    public List<String> getAcceptanceCriteria() {
        return acceptanceCriteria;
    }

    /** Replaces the criteria list; {@code null} clears it to an empty list (never stores {@code null}). */
    public void setAcceptanceCriteria(List<String> acceptanceCriteria) {
        this.acceptanceCriteria = acceptanceCriteria == null ? new ArrayList<>() : new ArrayList<>(acceptanceCriteria);
    }

    public boolean isAiGenerated() {
        return aiGenerated;
    }

    public void setAiGenerated(boolean aiGenerated) {
        this.aiGenerated = aiGenerated;
    }

    public String getAiModel() {
        return aiModel;
    }

    public void setAiModel(String aiModel) {
        this.aiModel = aiModel;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void touch() {
        this.updatedAt = OffsetDateTime.now();
    }

    /**
     * Applies a move to a (possibly different) column at a new gap-based
     * position (spec: kanban-board move; design D10). Used only by {@link
     * com.flowpilot.service.BoardService#move}.
     */
    public void moveTo(Long columnId, int position) {
        this.columnId = columnId;
        this.position = position;
        touch();
    }

    /**
     * Reassigns this item's position without changing its column — used to
     * re-sequence siblings during a move within the same column when the
     * gap-based strategy runs out of room (design D10).
     */
    public void setPosition(int position) {
        this.position = position;
    }
}
