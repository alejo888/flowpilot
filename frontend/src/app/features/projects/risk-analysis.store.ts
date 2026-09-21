import { Injectable, inject, signal } from '@angular/core';

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

  /** Bumped by every analyze() and reset(); a response only lands if it still matches. */
  private generation = 0;

  analyze(projectId: number): Promise<boolean> {
    const token = ++this.generation;
    this.loading.set(true);
    this.error.set(null);

    return new Promise((resolve) =>
      this.api.analyze(projectId).subscribe({
        next: (response) => {
          if (token !== this.generation) {
            resolve(false);
            return;
          }
          this.result.set(response);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          if (token !== this.generation) {
            resolve(false);
            return;
          }
          this.loading.set(false);
          this.error.set(
            (err as { error?: { detail?: string } })?.error?.detail ?? 'No se pudo analizar los riesgos',
          );
          resolve(false);
        },
      }),
    );
  }

  /** Clears result, error and loading and invalidates any in-flight request (e.g. on project switch). */
  reset(): void {
    this.generation++;
    this.loading.set(false);
    this.result.set(null);
    this.error.set(null);
  }
}
