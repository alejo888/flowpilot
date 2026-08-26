package com.flowpilot.dto;

import io.swagger.v3.oas.annotations.media.Schema;
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
 * since the dense 6x11 seed always has 66 rows).
 */
public record RolePermissionUpdateRequest(
        @NotEmpty(message = "La lista de permisos no puede estar vacía") List<@Valid RolePermissionGrant> grants,
        @Schema(nullable = true) OffsetDateTime expectedUpdatedAt) {
}
