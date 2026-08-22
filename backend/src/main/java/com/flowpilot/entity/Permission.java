package com.flowpilot.entity;

/**
 * Fixed, code-level catalog of project-scoped permissions (confirmed decision
 * 5b/10). Only the 6x9 {@code role_permissions} GRANTS are data; the catalog
 * itself is a compile-time enum — adding a new permission is a code +
 * migration change, never a runtime admin action.
 *
 * <p>Guards (proposal's "Permission Catalog" table):
 * <ul>
 *   <li>{@link #PROJECT_EDIT_SETTINGS} — {@code PUT /api/projects/{id}}, {@code PATCH /api/projects/{id}/status}</li>
 *   <li>{@link #PROJECT_DELETE} — {@code DELETE /api/projects/{id}}</li>
 *   <li>{@link #MEMBER_ADD} — {@code POST /api/projects/{id}/members}</li>
 *   <li>{@link #MEMBER_REMOVE} — {@code DELETE /api/projects/{id}/members/{userId}}</li>
 *   <li>{@link #MEMBER_CHANGE_ROLE} — {@code PUT /api/projects/{id}/members/{userId}}</li>
 *   <li>{@link #WORKITEM_CREATE} — {@code POST /api/projects/{id}/work-items}</li>
 *   <li>{@link #WORKITEM_EDIT} — {@code PUT /api/work-items/{id}}</li>
 *   <li>{@link #WORKITEM_DELETE} — {@code DELETE /api/work-items/{id}}</li>
 *   <li>{@link #WORKITEM_MOVE} — {@code PUT /api/work-items/{id}/move}</li>
 * </ul>
 *
 * Reads (GET) are never gated by this catalog — membership alone grants read
 * access (design's {@code canRead} formula, unaffected by slice 8a).
 */
public enum Permission {
    PROJECT_EDIT_SETTINGS,
    PROJECT_DELETE,
    MEMBER_ADD,
    MEMBER_REMOVE,
    MEMBER_CHANGE_ROLE,
    WORKITEM_CREATE,
    WORKITEM_EDIT,
    WORKITEM_DELETE,
    WORKITEM_MOVE,
        COMMENT_CREATE
}
