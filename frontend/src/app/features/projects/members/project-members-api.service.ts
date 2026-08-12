import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ProjectMember } from './project-member.model';

/**
 * Thin HTTP client for a project's member roster (spec: project-members-ui).
 * Uses relative `/api/...` paths, matching `ProjectsApiService`/
 * `BoardApiService` (design D8's colocation precedent). PR1 exposes
 * `listMembers` only — `addMember`/`changeRole`/`removeMember` land in
 * PR2/PR3.
 */
@Injectable({ providedIn: 'root' })
export class ProjectMembersApiService {
  private readonly http = inject(HttpClient);

  listMembers(projectId: number): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(`/api/projects/${projectId}/members`);
  }
}
