import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { RiskAnalysisApiService } from './risk-analysis.api';
import { RiskAnalysisResponse } from './risk-analysis.model';
import { RiskAnalysisStore } from './risk-analysis.store';

function analysis(summary = 'Resumen'): RiskAnalysisResponse {
  return {
    signals: [{ type: 'SPRINT_OVERDUE', severity: 'HIGH', title: 'Sprint vencido', detail: 'd' }],
    summary,
    recommendations: ['Replanificar'],
    generatedBy: 'OLLAMA',
    model: 'llama3',
  };
}

describe('RiskAnalysisStore', () => {
  let api: { analyze: ReturnType<typeof vi.fn> };
  let store: RiskAnalysisStore;

  beforeEach(() => {
    api = { analyze: vi.fn() };
    TestBed.configureTestingModule({
      providers: [RiskAnalysisStore, { provide: RiskAnalysisApiService, useValue: api }],
    });
    store = TestBed.inject(RiskAnalysisStore);
  });

  it('stores the analysis on success', async () => {
    api.analyze.mockReturnValue(of(analysis()));

    const ok = await store.analyze(10);

    expect(ok).toBe(true);
    expect(api.analyze).toHaveBeenCalledWith(10);
    expect(store.result()?.summary).toBe('Resumen');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sets loading while the request is in flight', async () => {
    const pending = new Subject<RiskAnalysisResponse>();
    api.analyze.mockReturnValue(pending);

    const p = store.analyze(10);
    expect(store.loading()).toBe(true);
    pending.next(analysis());
    pending.complete();
    await p;

    expect(store.loading()).toBe(false);
  });

  it('resolves false with the Spanish detail on failure and leaves no result', async () => {
    api.analyze.mockReturnValue(throwError(() => ({ error: { detail: 'IA no disponible' } })));

    const ok = await store.analyze(10);

    expect(ok).toBe(false);
    expect(store.result()).toBeNull();
    expect(store.error()).toBe('IA no disponible');
    expect(store.loading()).toBe(false);
  });

  it('keeps the previous result when a later analysis fails, with a fallback message', async () => {
    api.analyze.mockReturnValueOnce(of(analysis()));
    await store.analyze(10);
    api.analyze.mockReturnValueOnce(throwError(() => ({})));

    const ok = await store.analyze(10);

    expect(ok).toBe(false);
    expect(store.result()?.summary).toBe('Resumen');
    expect(store.error()).toBe('No se pudo analizar los riesgos');
  });

  it('clears a stale error when a new analysis starts', async () => {
    api.analyze.mockReturnValueOnce(throwError(() => ({})));
    await store.analyze(10);
    api.analyze.mockReturnValueOnce(of(analysis()));
    await store.analyze(10);

    expect(store.error()).toBeNull();
  });

  it('reset() clears result, error and loading', async () => {
    api.analyze.mockReturnValue(of(analysis()));
    await store.analyze(10);
    store.error.set('algo');

    store.reset();

    expect(store.result()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('ignores a late success after reset() and resolves false', async () => {
    const pending = new Subject<RiskAnalysisResponse>();
    api.analyze.mockReturnValue(pending);

    const result = store.analyze(10);
    store.reset();
    pending.next(analysis());
    pending.complete();

    expect(await result).toBe(false);
    expect(store.result()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('ignores a late error after reset() and resolves false', async () => {
    const pending = new Subject<RiskAnalysisResponse>();
    api.analyze.mockReturnValue(pending);

    const result = store.analyze(10);
    store.reset();
    pending.error({ error: { detail: 'tarde' } });

    expect(await result).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('overlapping analyze(): the older response neither lands nor clears loading', async () => {
    const first = new Subject<RiskAnalysisResponse>();
    const second = new Subject<RiskAnalysisResponse>();
    api.analyze.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const older = store.analyze(10);
    const newer = store.analyze(10);
    first.next(analysis('vieja'));
    first.complete();

    expect(await older).toBe(false);
    expect(store.loading()).toBe(true);
    expect(store.result()).toBeNull();

    second.next(analysis('nueva'));
    second.complete();

    expect(await newer).toBe(true);
    expect(store.result()?.summary).toBe('nueva');
  });
});
