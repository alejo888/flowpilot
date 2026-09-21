import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RiskAnalysisResponse } from './risk-analysis.model';

/** Thin HTTP client for the AI risk analysis (vision 7.6); the POST has no body. */
@Injectable({ providedIn: 'root' })
export class RiskAnalysisApiService {
  private readonly http = inject(HttpClient);

  analyze(projectId: number): Observable<RiskAnalysisResponse> {
    return this.http.post<RiskAnalysisResponse>(`/api/projects/${projectId}/ai/risk-analysis`, null);
  }
}
