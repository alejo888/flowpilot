import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Project } from '../projects/project.model';
import {
  GenerateProjectDraftRequest,
  ProjectDraftResponse,
  ProjectWithBacklogRequest,
} from './ai-projects.model';

/** Thin HTTP client for AI project creation (vision 7.4); relative `/api/...` paths. */
@Injectable({ providedIn: 'root' })
export class AiProjectsApiService {
  private readonly http = inject(HttpClient);

  generateDraft(request: GenerateProjectDraftRequest): Observable<ProjectDraftResponse> {
    return this.http.post<ProjectDraftResponse>('/api/ai/project-draft', request);
  }

  createProjectWithBacklog(request: ProjectWithBacklogRequest): Observable<Project> {
    return this.http.post<Project>('/api/projects/with-backlog', request);
  }
}
