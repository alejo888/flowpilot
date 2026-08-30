import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { GenerateUserStoryRequest, GeneratedUserStoryResponse } from './ai-stories.model';

/**
 * Thin HTTP client for AI user-story generation (spec: ai-user-story-generation).
 * Relative `/api/...` path per the same reverse-proxy convention as
 * {@link BoardApiService}. Confirming a draft reuses the work-item create
 * endpoint (see {@link AiStoriesStore}), so no create method lives here.
 */
@Injectable({ providedIn: 'root' })
export class AiStoriesApiService {
  private readonly http = inject(HttpClient);

  generateUserStory(
    projectId: number,
    request: GenerateUserStoryRequest,
  ): Observable<GeneratedUserStoryResponse> {
    return this.http.post<GeneratedUserStoryResponse>(
      `/api/projects/${projectId}/ai/user-stories`,
      request,
    );
  }
}
