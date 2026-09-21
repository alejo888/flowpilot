import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AiConfigService } from '../../core/ai/ai-config.service';
import { RiskAnalysisResponse } from './risk-analysis.model';
import { RiskAnalysisCardComponent } from './risk-analysis-card.component';
import { RiskAnalysisStore } from './risk-analysis.store';

function analysis(overrides: Partial<RiskAnalysisResponse> = {}): RiskAnalysisResponse {
  return {
    signals: [
      { type: 'STALLED_ITEM', severity: 'LOW', title: 'Tarea estancada', detail: 'Sin cambios 9 días', workItemId: 4 },
      { type: 'SPRINT_OVERDUE', severity: 'HIGH', title: 'Sprint vencido', detail: 'Terminó hace 2 días' },
      { type: 'LARGE_STORY', severity: 'MEDIUM', title: 'Historia grande', detail: '6 subtareas' },
    ],
    summary: 'El sprint está en riesgo.',
    recommendations: ['Replanificar el sprint', 'Repartir la carga'],
    generatedBy: 'STUB',
    model: null,
    ...overrides,
  };
}

describe('RiskAnalysisCardComponent', () => {
  let fixture: ComponentFixture<RiskAnalysisCardComponent>;
  let aiEnabled: ReturnType<typeof signal<boolean>>;
  let store: {
    result: ReturnType<typeof signal<RiskAnalysisResponse | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    analyze: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(async () => {
    aiEnabled = signal(true);
    store = {
      result: signal(null),
      loading: signal(false),
      error: signal(null),
      analyze: vi.fn().mockResolvedValue(true),
      reset: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [RiskAnalysisCardComponent],
      providers: [
        provideRouter([]),
        { provide: AiConfigService, useValue: { aiEnabled } },
        { provide: RiskAnalysisStore, useValue: store },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RiskAnalysisCardComponent);
    fixture.componentRef.setInput('projectId', 10);
  });

  it('renders nothing when AI is disabled', () => {
    aiEnabled.set(false);
    fixture.detectChanges();

    expect(q('analyze-risks')).toBeNull();
    expect(root().textContent).not.toContain('Riesgos (IA)');
  });

  it('shows the heading and button when AI is enabled', () => {
    fixture.detectChanges();

    expect(root().querySelector('h2')?.textContent).toContain('Riesgos (IA)');
    expect(q('analyze-risks')?.textContent).toContain('Analizar riesgos');
  });

  it('calls the store with the project id when the button is clicked', () => {
    fixture.detectChanges();

    q('analyze-risks')!.click();

    expect(store.analyze).toHaveBeenCalledWith(10);
  });

  it('disables the button and shows a busy state while loading', () => {
    store.loading.set(true);
    fixture.detectChanges();

    const button = q('analyze-risks') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(root().textContent).toContain('Analizando');
  });

  it('renders summary, recommendations and signals ordered by severity with text labels', () => {
    store.result.set(analysis());
    fixture.detectChanges();

    expect(q('risk-summary')?.textContent).toContain('El sprint está en riesgo.');
    const recs = Array.from(root().querySelectorAll('[data-testid="risk-recommendation"]')).map((e) =>
      e.textContent?.trim(),
    );
    expect(recs).toEqual(['Replanificar el sprint', 'Repartir la carga']);

    const signals = Array.from(root().querySelectorAll('[data-testid="risk-signal"]'));
    expect(signals.map((s) => s.querySelector('[data-testid="risk-severity"]')?.textContent?.trim())).toEqual([
      'Alta',
      'Media',
      'Baja',
    ]);
    expect(signals[0].textContent).toContain('Sprint vencido');
    expect(signals[0].textContent).toContain('Terminó hace 2 días');
  });

  it('links a work-item signal to the board', () => {
    store.result.set(analysis());
    fixture.detectChanges();

    const link = root().querySelector('[data-testid="risk-signal"] a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/projects/10/board');
    expect(root().querySelectorAll('[data-testid="risk-signal"] a').length).toBe(1);
  });

  it('shows only the summary when there are no signals', () => {
    store.result.set(analysis({ signals: [], recommendations: [], summary: 'No se detectaron riesgos.' }));
    fixture.detectChanges();

    expect(q('risk-summary')?.textContent).toContain('No se detectaron riesgos.');
    expect(root().querySelector('[data-testid="risk-signal"]')).toBeNull();
    expect(root().querySelector('[data-testid="risk-recommendation"]')).toBeNull();
  });

  it('shows the error in an alert and keeps the previous result', () => {
    store.result.set(analysis());
    store.error.set('El asistente de IA no está disponible en este momento.');
    fixture.detectChanges();

    const alert = q('analyze-risks-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('El asistente de IA no está disponible');
    expect(q('risk-summary')?.textContent).toContain('El sprint está en riesgo.');
  });

  it('resets the store when the project changes', () => {
    fixture.detectChanges();
    store.reset.mockClear();

    fixture.componentRef.setInput('projectId', 11);
    fixture.detectChanges();

    expect(store.reset).toHaveBeenCalled();
  });
});
