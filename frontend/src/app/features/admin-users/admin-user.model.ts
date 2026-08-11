/**
 * Admin-user domain model (spec: user-administration). Mirrors the
 * backend's UserAdminResponse shape (api/openapi.yaml).
 */
export type GlobalRole = 'ADMINISTRADOR' | 'MIEMBRO_EQUIPO';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: GlobalRole;
  active: boolean;
}

/** Request body for PATCH /api/admin/users/{id}/status. */
export interface UserStatusUpdateRequest {
  active: boolean;
}

/** Request body for PUT /api/admin/users/{id}/role. */
export interface UserRoleUpdateRequest {
  role: GlobalRole;
}
