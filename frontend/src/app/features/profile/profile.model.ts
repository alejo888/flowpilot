/**
 * Own-profile domain model (spec: profile). Mirrors the backend's
 * UserAdminResponse shape (api/openapi.yaml) — GET /api/users/me reuses that
 * DTO since its id/name/email/role/active fields already fit.
 */
export type GlobalRole = 'ADMINISTRADOR' | 'MIEMBRO_EQUIPO';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: GlobalRole;
  active: boolean;
}

/** Request body for PUT /api/users/me/password. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
