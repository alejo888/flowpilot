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
}

export interface ProjectCreateRequest {
  name: string;
  description: string | null;
}
