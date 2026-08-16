import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Project, ProjectCreateRequest, ProjectStatusRequest, ProjectUpdateRequest } from './project.model';

/**
 * Thin HTTP client for projects (spec: projects-ui). Uses relative
 * `/api/...` paths per design D8 (same-origin reverse proxy in Docker;
 * `proxy.conf.json` proxies `/api` to `localhost:8080` for local
 * `ng serve`).
 */
@Injectable({ providedIn: 'root' })
export class ProjectsApiService {
  private readonly http = inject(HttpClient);

  listProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('/api/projects');
  }

  createProject(request: ProjectCreateRequest): Observable<Project> {
    return this.http.post<Project>('/api/projects', request);
  }

  getProject(id: number): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${id}`);
  }

  updateProject(id: number, request: ProjectUpdateRequest): Observable<Project> {
    return this.http.put<Project>(`/api/projects/${id}`, request);
  }

  updateProjectStatus(id: number, request: ProjectStatusRequest): Observable<Project> {
    return this.http.patch<Project>(`/api/projects/${id}/status`, request);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`/api/projects/${id}`);
  }
}
