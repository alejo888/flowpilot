import { Injectable, inject, signal } from '@angular/core';

import { LatestRequest } from '../../core/api/latest-request';
import { RiskAnalysisApiService } from './risk-analysis.api';
import { RiskAnalysisResponse } from './risk-analysis.model';

/**
 * Sibling signals store for the AI risk analysis (vision 7.6). Kept apart from
 * `ProjectDashboardStore` so an AI failure never affects the dashboard metrics.
 *
 * {@link analyze} resolves `Promise<boolean>` — `true` only once the server
 * returned an analysis — and a failure never clears an on-screen result.
 * Nothing here is persisted.
 */
@Injectable({ providedIn: 'root' })
export class RiskAnalysisStore {
  private readonly api = inject(RiskAnalysisApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** `null` = no analysis on screen. */
  readonly result = signal<RiskAnalysisResponse | null>(null);

  /** Invalidated by every analyze() and reset(); a response only lands while it is the latest. */
  private readonly analysis = new LatestRequest(this.loading, this.error);

  analyze(projectId: number): Promise<boolean> {
    return this.analysis.run(this.api.analyze(projectId), {
      onSuccess: (response) => this.result.set(response),
      fallback: 'No se pudo analizar los riesgos',
    });
  }

  /** Clears result, error and loading and invalidates any in-flight request (e.g. on project switch). */
  reset(): void {
    this.analysis.invalidate();
    this.result.set(null);
    this.error.set(null);
  }
}
