import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { GenerateAcceptanceCriteriaRequest, GeneratedAcceptanceCriteriaResponse } from './board.model';

/**
 * Thin HTTP client for AI acceptance-criteria generation (spec:
 * ai-acceptance-criteria-generation, PR 2). Relative `/api/...` path per the
 * same reverse-proxy convention as the other board services. Returns a
 * non-persisted draft list; nothing is persisted until the criteria are
 * attached through the existing `PUT /api/work-items/{id}`.
 */
@Injectable({ providedIn: 'root' })
export class AiCriteriaApiService {
  private readonly http = inject(HttpClient);

  generate(projectId: number, workItemId: number): Observable<GeneratedAcceptanceCriteriaResponse> {
    const request: GenerateAcceptanceCriteriaRequest = { workItemId };
    return this.http.post<GeneratedAcceptanceCriteriaResponse>(
      `/api/projects/${projectId}/ai/acceptance-criteria`,
      request,
    );
  }
}
