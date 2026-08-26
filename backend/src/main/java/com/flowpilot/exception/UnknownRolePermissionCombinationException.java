package com.flowpilot.exception;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;

/**
 * Thrown when a bulk {@code PUT /api/admin/role-permissions} request names a
 * {@code (role, permission)} pair absent from the dense matrix — e.g. a new
 * {@link Permission} constant that shipped ahead of its seed migration.
 * Maps to HTTP 400: the caller sent a bad cell reference, not a server fault.
 */
public class UnknownRolePermissionCombinationException extends RuntimeException {

    public UnknownRolePermissionCombinationException(ProjectRole role, Permission permission) {
        super("Combinación de rol/permiso desconocida: " + role + "/" + permission);
    }
}
