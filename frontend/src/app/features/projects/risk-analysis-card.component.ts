import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AiConfigService } from '../../core/ai/ai-config.service';
import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { RiskSeverity } from './risk-analysis.model';
import { RiskAnalysisStore } from './risk-analysis.store';

const SEVERITY_ORDER: Record<RiskSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const SEVERITY_LABELS: Record<RiskSeverity, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const SEVERITY_VARIANTS: Record<RiskSeverity, 'danger' | 'warning' | 'neutral'> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

/** "Riesgos (IA)" dashboard card (vision 7.6): on-demand, non-persisted risk analysis. */
@Component({
  selector: 'app-risk-analysis-card',
  standalone: true,
  imports: [RouterLink, FpCardComponent, FpBadgeComponent],
  template: `
    @if (aiEnabled()) {
      <fp-card>
        <h2>Riesgos (IA)</h2>
        <button
          type="button"
          data-testid="analyze-risks"
          [disabled]="store.loading()"
          [attr.aria-busy]="store.loading()"
          (click)="analyze()"
        >
          {{ store.loading() ? 'Analizando…' : 'Analizar riesgos' }}
        </button>
        @if (store.error(); as error) {
          <p class="error" role="alert" data-testid="analyze-risks-error">{{ error }}</p>
        }
        <div role="status" aria-live="polite">
          @if (store.result(); as r) {
            <p data-testid="risk-summary">{{ r.summary }}</p>
            @if (r.recommendations.length) {
              <h3>Recomendaciones</h3>
              <ul>
                @for (rec of r.recommendations; track $index) {
                  <li data-testid="risk-recommendation">{{ rec }}</li>
                }
              </ul>
            }
            @if (signals().length) {
              <h3>Señales de riesgo</h3>
              <ul>
                @for (s of signals(); track $index) {
                  <li data-testid="risk-signal">
                    <fp-badge [variant]="variant(s.severity)">
                      <span data-testid="risk-severity">{{ label(s.severity) }}</span>
                    </fp-badge>
                    <strong>{{ s.title }}</strong>
                    <span class="detail">{{ s.detail }}</span>
                    @if (s.workItemId) {
                      <a [routerLink]="['/projects', projectId(), 'board']">Ver tablero</a>
                    }
                  </li>
                }
              </ul>
            }
          }
        </div>
      </fp-card>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1rem;
    }
    h2,
    h3 {
      font-family: var(--fp-font-display);
      margin: 0;
    }
    h2 {
      font-size: 1.15rem;
      margin-bottom: 0.75rem;
    }
    h3 {
      font-size: 1rem;
      margin-top: 1rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0.5rem 0 0;
    }
    li {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--fp-border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .detail {
      color: var(--fp-text-muted);
      flex-basis: 100%;
    }
    a {
      color: var(--fp-accent);
    }
    .error {
      color: var(--fp-danger);
    }
  `,
})
export class RiskAnalysisCardComponent {
  readonly projectId = input.required<number>();
  readonly store = inject(RiskAnalysisStore);
  readonly aiEnabled = inject(AiConfigService).aiEnabled;

  /** Signals ordered HIGH → MEDIUM → LOW (stable within a severity). */
  readonly signals = computed(() =>
    [...(this.store.result()?.signals ?? [])].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    ),
  );

  constructor() {
    // A previous project's analysis must never show under another project.
    effect(() => {
      this.projectId();
      untracked(() => this.store.reset());
    });
  }

  analyze(): void {
    void this.store.analyze(this.projectId());
  }

  label(severity: RiskSeverity): string {
    return SEVERITY_LABELS[severity];
  }

  variant(severity: RiskSeverity): 'danger' | 'warning' | 'neutral' {
    return SEVERITY_VARIANTS[severity];
  }
}
