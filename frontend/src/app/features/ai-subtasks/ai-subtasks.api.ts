import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkItem } from '../board/board.model';
import {
  GenerateSubtasksRequest,
  GeneratedSubtasksResponse,
  WorkItemBatchCreateRequest,
} from './ai-subtasks.model';

/**
 * Thin HTTP client for AI subtask generation (spec: ai-subtask-generation).
 * Relative `/api/...` path per the same reverse-proxy convention as
 * {@link BoardApiService}. {@link generateSubtasks} returns a non-persisted
 * draft list; {@link createBatch} turns the edited drafts into real work items
 * through the transactional batch endpoint once the user confirms (PR 3b).
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

  createBatch(
    projectId: number,
    request: WorkItemBatchCreateRequest,
  ): Observable<WorkItem[]> {
    return this.http.post<WorkItem[]>(`/api/projects/${projectId}/work-items/batch`, request);
  }
}
