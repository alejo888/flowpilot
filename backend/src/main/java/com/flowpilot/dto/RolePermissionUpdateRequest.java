package com.flowpilot.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Bulk atomic-replace payload for {@code PUT /api/admin/role-permissions}
 * (spec: role-permissions, "Bulk update success" / "Concurrent conflicting
 * edit" scenarios). {@code expectedUpdatedAt} is the {@code
 * MAX(role_permissions.updated_at)} value the caller read from a prior
 * {@code GET /api/admin/role-permissions} response; the service 409s if it
 * no longer matches the persisted value (optimistic concurrency, no partial
 * apply). {@code null} matches an empty table only (never true in practice,
 * since the dense 6x9 seed always has 54 rows).
 */
public record RolePermissionUpdateRequest(
        @NotEmpty List<@Valid RolePermissionGrant> grants,
        OffsetDateTime expectedUpdatedAt) {
}
