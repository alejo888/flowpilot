import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { GeneratedUserStoryResponse } from '../ai-stories/ai-stories.model';
import { GenerateAcceptanceCriteriaRequest } from './board.model';

/**
 * Thin HTTP client for AI story improvement (vision 7.7). Sends an existing
 * work item's id and receives a non-persisted draft (improved user story plus
 * criteria); nothing is saved until the board panel's regular `PUT`.
 */
@Injectable({ providedIn: 'root' })
export class AiStoryImprovementApiService {
  private readonly http = inject(HttpClient);

  improve(projectId: number, workItemId: number): Observable<GeneratedUserStoryResponse> {
    const request: GenerateAcceptanceCriteriaRequest = { workItemId };
    return this.http.post<GeneratedUserStoryResponse>(
      `/api/projects/${projectId}/ai/story-improvement`,
      request,
    );
  }
}
