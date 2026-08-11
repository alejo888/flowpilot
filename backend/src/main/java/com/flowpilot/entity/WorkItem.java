package com.flowpilot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * A single-type "Tarea" task scoped to a {@link Project} (spec: work-items;
 * confirmed decision 4 — no {@code type} column, one implicit type in MVP).
 * References a {@link BoardColumn} via {@code columnId} rather than a status
 * enum (confirmed decision 9). {@code position} is the item's within-column
 * ordering, using the same gap-based strategy as {@code BoardColumn.position}
 * (design D10): new items start at {@code max(position in column) + 1024}, or
 * {@code 1024} if the column is empty. The move endpoint that mutates {@code
 * columnId}/{@code position} together is slice 6 (Kanban board) — this slice
 * only creates items into the project's first column and never changes
 * either field after creation.
 */
@Entity
@Table(name = "work_items")
public class WorkItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected WorkItem() {
        // JPA
    }

    public WorkItem(
            Long projectId, Long columnId, String title, String description, Long assignedUserId, int position) {
        this.projectId = projectId;
        this.columnId = columnId;
        this.title = title;
        this.description = description;
        this.assignedUserId = assignedUserId;
        this.position = position;
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

    public int getPosition() {
        return position;
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
