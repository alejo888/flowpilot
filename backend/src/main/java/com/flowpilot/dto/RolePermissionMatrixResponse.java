package com.flowpilot.dto;

import com.flowpilot.entity.ProjectRole;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Full 6x11 permission matrix response (spec: role-permissions, "Get matrix"
 * scenario): {@code roles} and {@code permissions} are the fixed code
 * catalogs (for rendering the admin grid), {@code grants} are the 66 data
 * rows, and {@code updatedAt} is {@code MAX(role_permissions.updated_at)} —
 * the value slice 8b's bulk {@code PUT} compares as {@code
 * expectedUpdatedAt} for optimistic concurrency.
 */
public record RolePermissionMatrixResponse(
        List<ProjectRole> roles,
        List<RolePermissionCatalogEntry> permissions,
        List<RolePermissionGrant> grants,
        OffsetDateTime updatedAt) {
}
