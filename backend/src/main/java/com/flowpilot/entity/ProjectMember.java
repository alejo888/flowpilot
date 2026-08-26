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
import java.time.OffsetDateTime;

/**
 * A user's membership in a {@link Project} with a {@link ProjectRole} (spec:
 * project-membership). {@code projectId}/{@code userId} are plain FK columns
 * (not JPA relations), matching {@code Project}'s {@code ownerId} pattern so
 * {@code ProjectAuthorizationService} can do lightweight existence checks.
 *
 * <p>{@code version} (V15 migration) backs JPA's built-in optimistic locking,
 * same convention as {@code Project}: two concurrent role changes on the
 * same row now fail the second with a 409 instead of silently last-write-wins.
 */
@Entity
@Table(name = "project_members")
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectRole role;

    @Column(name = "joined_at", nullable = false)
    private OffsetDateTime joinedAt;

    protected ProjectMember() {
        // JPA
    }

    public ProjectMember(Long projectId, Long userId, ProjectRole role) {
        this.projectId = projectId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public Long getUserId() {
        return userId;
    }

    public ProjectRole getRole() {
        return role;
    }

    public void setRole(ProjectRole role) {
        this.role = role;
    }

    public OffsetDateTime getJoinedAt() {
        return joinedAt;
    }
}
