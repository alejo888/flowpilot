package com.flowpilot.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * A single (role, permission) grant row (confirmed decision 5b). Dense
 * representation: all 6x11 = 66 combinations exist as rows from the seed
 * migration ({@code V7__seed_role_permissions.sql}); the admin screen (slice
 * 8b) flips {@code granted}, never inserts or deletes. Unique {@code (role,
 * permission)} enforced at the database level.
 *
 * <p>{@code updatedId}/{@code updatedAt} back the bulk {@code PUT}'s
 * optimistic-concurrency check (slice 8b): {@code GET
 * /api/admin/role-permissions} reports {@code MAX(updated_at)} across all
 * rows, and the write compares it against the caller's {@code
 * expectedUpdatedAt} before applying.
 */
@Entity
@Table(name = "role_permissions")
public class RolePermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Permission permission;

    @Column(nullable = false)
    private boolean granted;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    protected RolePermission() {
        // JPA
    }

    public RolePermission(ProjectRole role, Permission permission, boolean granted) {
        this.role = role;
        this.permission = permission;
        this.granted = granted;
        this.updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public ProjectRole getRole() {
        return role;
    }

    public Permission getPermission() {
        return permission;
    }

    public boolean isGranted() {
        return granted;
    }

    public void setGranted(boolean granted) {
        this.granted = granted;
        this.updatedAt = OffsetDateTime.now();
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public Long getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(Long updatedBy) {
        this.updatedBy = updatedBy;
    }
}
