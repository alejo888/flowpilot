package com.flowpilot.dto;

import com.flowpilot.entity.Permission;
import com.flowpilot.entity.ProjectRole;

/** One (role, permission) grant cell (spec: role-permissions). */
public record RolePermissionGrant(ProjectRole role, Permission permission, boolean granted) {
}
