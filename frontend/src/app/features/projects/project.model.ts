import { Permission } from '../admin-permissions/role-permission.model';

/**
 * Project domain models (spec: projects-ui). Mirror the backend's
 * ProjectResponse / ProjectCreateRequest shapes (ProjectController,
 * dto/ProjectResponse.java, dto/ProjectCreateRequest.java).
 */
export type ProjectStatus = 'PLANIFICACION' | 'ACTIVO' | 'PAUSADO' | 'FINALIZADO' | 'CANCELADO';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  code: string | null;
  startDate: string | null;
  estimatedEndDate: string | null;
  technologies: string | null;
  repositoryUrl: string | null;
  callerPermissions: Permission[];
}

/**
 * Fail-closed permission check: a null/undefined project (still loading, or
 * not yet fetched) never grants a permission. Centralizes the
 * `.includes(...)` check so the four permission-gated screens don't drift.
 */
export function hasPermission(project: Project | null | undefined, permission: Permission): boolean {
  return project?.callerPermissions?.includes(permission) ?? false;
}

export interface ProjectCreateRequest {
  name: string;
  description: string | null;
  code: string | null;
  startDate: string | null;
  estimatedEndDate: string | null;
  technologies: string | null;
  repositoryUrl: string | null;
}

export type ProjectUpdateRequest = ProjectCreateRequest;

export interface ProjectStatusRequest {
  status: ProjectStatus;
}
