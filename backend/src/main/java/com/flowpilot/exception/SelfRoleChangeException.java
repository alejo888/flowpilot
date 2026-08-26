package com.flowpilot.exception;

/**
 * Thrown when a caller tries to change their own project role via {@code PUT
 * /api/projects/{projectId}/members/{userId}}. Without this guard, any
 * member holding {@code MEMBER_CHANGE_ROLE} (e.g. a role an administrator
 * granted it to via the role-permission matrix) could promote themselves to
 * a role with broader permissions (e.g. {@code PROJECT_MANAGER}), since
 * {@code ProjectAuthorizationService} re-reads the member's role live on
 * every request with no self-lockout equivalent to the owner/admin
 * short-circuits. Maps to HTTP 403.
 */
public class SelfRoleChangeException extends RuntimeException {

    public SelfRoleChangeException() {
        super("No podés cambiar tu propio rol en el proyecto");
    }
}
