import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { GenerateSubtasksRequest, GeneratedSubtasksResponse } from './ai-subtasks.model';

/**
 * Thin HTTP client for AI subtask generation (spec: ai-subtask-generation).
 * Relative `/api/...` path per the same reverse-proxy convention as
 * {@link BoardApiService}. Turning the drafts into real work items reuses the
 * transactional batch create endpoint (PR 3b), so no create method lives here
 * yet.
 */
@Injectable({ providedIn: 'root' })
export class AiSubtasksApiService {
  private readonly http = inject(HttpClient);

  generateSubtasks(
    projectId: number,
    request: GenerateSubtasksRequest,
  ): Observable<GeneratedSubtasksResponse> {
    return this.http.post<GeneratedSubtasksResponse>(
      `/api/projects/${projectId}/ai/subtasks`,
      request,
    );
  }
}
