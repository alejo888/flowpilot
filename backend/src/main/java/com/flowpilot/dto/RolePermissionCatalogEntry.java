package com.flowpilot.dto;

import com.flowpilot.entity.Permission;

/**
 * Rendering metadata for one fixed catalog {@link Permission} (spec:
 * role-permissions). UI copy in Spanish per project convention; {@code key}
 * is the raw enum name so the frontend can join it back to a {@code grants}
 * row.
 */
public record RolePermissionCatalogEntry(Permission key, String label, String description) {
}
