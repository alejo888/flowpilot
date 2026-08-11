package com.flowpilot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * A Kanban column belonging to a {@link Project} (design decision 9 /
 * confirmed decision 9). Exactly 4 rows are seeded atomically on project
 * creation ({@code ProjectService.create}). Position uses design D10's
 * gap-based strategy (1024 step) so a future insert-between-two-columns
 * never requires re-sequencing every row.
 */
@Entity
@Table(name = "board_columns")
public class BoardColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int position;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected BoardColumn() {
        // JPA
    }

    public BoardColumn(Long projectId, String name, int position) {
        this.projectId = projectId;
        this.name = name;
        this.position = position;
        this.createdAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getName() {
        return name;
    }

    public int getPosition() {
        return position;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
