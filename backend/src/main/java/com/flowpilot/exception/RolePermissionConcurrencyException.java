package com.flowpilot.exception;

/**
 * Thrown when a bulk {@code PUT /api/admin/role-permissions} request's
 * {@code expectedUpdatedAt} no longer matches the persisted {@code
 * MAX(role_permissions.updated_at)} (spec: role-permissions, "Concurrent
 * conflicting edit" scenario) — another admin wrote the matrix since the
 * caller loaded it. Maps to HTTP 409, no partial apply.
 */
public class RolePermissionConcurrencyException extends RuntimeException {

    public RolePermissionConcurrencyException() {
        super("Role permission matrix was updated by someone else; reload and retry");
    }
}
