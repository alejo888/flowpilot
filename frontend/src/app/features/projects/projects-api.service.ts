import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Project } from './project.model';

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
}
