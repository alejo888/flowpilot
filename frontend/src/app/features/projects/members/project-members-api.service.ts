import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ProjectMember, ProjectMemberAddRequest } from './project-member.model';

/**
 * Thin HTTP client for a project's member roster (spec: project-members-ui).
 * Uses relative `/api/...` paths, matching `ProjectsApiService`/
 * `BoardApiService` (design D8's colocation precedent). PR1 exposed
 * `listMembers` only; PR2 adds `addMember` — `changeRole`/`removeMember`
 * land in PR3.
 */
@Injectable({ providedIn: 'root' })
export class ProjectMembersApiService {
  private readonly http = inject(HttpClient);

  listMembers(projectId: number): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(`/api/projects/${projectId}/members`);
  }

  addMember(projectId: number, request: ProjectMemberAddRequest): Observable<ProjectMember> {
    return this.http.post<ProjectMember>(`/api/projects/${projectId}/members`, request);
  }
}
