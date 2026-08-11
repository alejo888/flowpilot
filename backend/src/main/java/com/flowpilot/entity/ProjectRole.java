package com.flowpilot.entity;

/**
 * Project-scoped role assigned to a {@link ProjectMember} (design doc section
 * 6.3). MVP: these are descriptive labels only — they do not yet bear
 * permissions. The permission matrix (slice 8a) is what makes them
 * permission-bearing via {@code role_permissions}.
 */
public enum ProjectRole {
    PRODUCT_OWNER,
    PROJECT_MANAGER,
    DEVELOPER,
    UX_UI_DESIGNER,
    QA,
    DEVOPS
}
