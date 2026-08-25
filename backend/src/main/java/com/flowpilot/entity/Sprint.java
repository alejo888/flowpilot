package com.flowpilot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * A sprint within a {@link com.flowpilot.entity.Project} (spec: backlog and
 * sprints). {@code version} (V18 migration) backs JPA's built-in optimistic
 * locking, same convention as {@code Project}/{@code ProjectMember}/{@code
 * WorkItem}: two concurrent writes to the same row now fail the second with
 * a 409 instead of silently last-write-wins.
 */
@Entity
@Table(name = "sprints")
public class Sprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private String name;

    @Column
    private String goal;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SprintStatus status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Sprint() {
        // JPA
    }

    public Sprint(Long projectId, String name, String goal, LocalDate startDate, LocalDate endDate) {
        this.projectId = projectId;
        this.name = name;
        this.goal = goal;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = SprintStatus.PLANNED;
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

    public String getName() {
        return name;
    }

    public String getGoal() {
        return goal;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public SprintStatus getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String goal, LocalDate startDate, LocalDate endDate) {
        this.name = name;
        this.goal = goal;
        this.startDate = startDate;
        this.endDate = endDate;
        touch();
    }

    public void start() {
        if (status != SprintStatus.PLANNED) {
            throw new IllegalStateException("Solo los sprints planificados pueden iniciarse");
        }
        status = SprintStatus.ACTIVE;
        touch();
    }

    public void complete() {
        if (status != SprintStatus.ACTIVE) {
            throw new IllegalStateException("Solo los sprints activos pueden completarse");
        }
        status = SprintStatus.COMPLETED;
        touch();
    }

    private void touch() {
        updatedAt = OffsetDateTime.now();
    }
}
