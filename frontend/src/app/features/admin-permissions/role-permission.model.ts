/**
 * Role/permission matrix domain model (spec: role-permissions). Mirrors the
 * backend's RolePermissionMatrixResponse/RolePermissionUpdateRequest shapes
 * (api/openapi.yaml).
 */
export type ProjectRole =
  | 'PRODUCT_OWNER'
  | 'PROJECT_MANAGER'
  | 'DEVELOPER'
  | 'UX_UI_DESIGNER'
  | 'QA'
  | 'DEVOPS';

export type Permission =
  | 'PROJECT_EDIT_SETTINGS'
  | 'PROJECT_DELETE'
  | 'MEMBER_ADD'
  | 'MEMBER_REMOVE'
  | 'MEMBER_CHANGE_ROLE'
  | 'WORKITEM_CREATE'
  | 'WORKITEM_EDIT'
  | 'WORKITEM_DELETE'
  | 'WORKITEM_MOVE'
  | 'COMMENT_CREATE'
  | 'SPRINT_MANAGE';

export interface RolePermissionCatalogEntry {
  key: Permission;
  label: string;
  description: string;
}

export interface RolePermissionGrant {
  role: ProjectRole;
  permission: Permission;
  granted: boolean;
}

export interface RolePermissionMatrixResponse {
  roles: ProjectRole[];
  permissions: RolePermissionCatalogEntry[];
  grants: RolePermissionGrant[];
  updatedAt: string | null;
}

/** Request body for PUT /api/admin/role-permissions. */
export interface RolePermissionUpdateRequest {
  grants: RolePermissionGrant[];
  expectedUpdatedAt: string | null;
}

/** Stable "role:permission" key used for dirty-tracking and cell lookup. */
export function gridKey(role: ProjectRole, permission: Permission): string {
  return `${role}:${permission}`;
}
