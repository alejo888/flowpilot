import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AiCriteriaApiService } from './ai-criteria.api';
import { AiCriteriaStore, mergeCriteria } from './ai-criteria.store';
import { GeneratedAcceptanceCriteriaResponse } from './board.model';

function generated(
  overrides: Partial<GeneratedAcceptanceCriteriaResponse> = {},
): GeneratedAcceptanceCriteriaResponse {
  return {
    criteria: ['Sugerencia 1', 'Sugerencia 2', 'Sugerencia 3'],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

describe('mergeCriteria', () => {
  it('keeps existing criteria first and appends the suggestions', () => {
    expect(mergeCriteria(['A', 'B'], ['C', 'D'])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('de-duplicates by trimmed string, keeping the first occurrence', () => {
    expect(mergeCriteria(['A', ' B '], ['B', 'C', 'A'])).toEqual(['A', ' B ', 'C']);
  });

  it('caps the merged list at 8 entries', () => {
    const existing = ['1', '2', '3', '4', '5'];
    const suggestions = ['6', '7', '8', '9', '10'];
    expect(mergeCriteria(existing, suggestions)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('drops blank suggestions', () => {
    expect(mergeCriteria(['A'], ['', '   ', 'B'])).toEqual(['A', 'B']);
  });
});

describe('AiCriteriaStore', () => {
  let api: { generate: ReturnType<typeof vi.fn> };
  let store: AiCriteriaStore;

  beforeEach(() => {
    api = { generate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [AiCriteriaStore, { provide: AiCriteriaApiService, useValue: api }],
    });
    store = TestBed.inject(AiCriteriaStore);
  });

  it('seeds the draft with existing criteria first then the suggestions on success', async () => {
    api.generate.mockReturnValue(of(generated()));

    const ok = await store.generate(10, 55, ['Escrito a mano 1', 'Escrito a mano 2']);

    expect(ok).toBe(true);
    expect(api.generate).toHaveBeenCalledWith(10, 55);
    expect(store.draft()).toEqual([
      'Escrito a mano 1',
      'Escrito a mano 2',
      'Sugerencia 1',
      'Sugerencia 2',
      'Sugerencia 3',
    ]);
    expect(store.model()).toBe('llama3');
    expect(store.generatedBy()).toBe('OLLAMA');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('resolves false and leaves the draft untouched when generation fails with 503', async () => {
    api.generate.mockReturnValue(
      throwError(() => ({ error: { detail: 'El asistente de IA no está disponible en este momento.' } })),
    );

    const ok = await store.generate(10, 55, ['Escrito a mano']);

    expect(ok).toBe(false);
    expect(store.draft()).toBeNull();
    expect(store.error()).toBe('El asistente de IA no está disponible en este momento.');
    expect(store.loading()).toBe(false);
  });

  it('falls back to a generic message when the error carries no detail', async () => {
    api.generate.mockReturnValue(throwError(() => ({})));

    await store.generate(10, 55, []);

    expect(store.error()).toBe('No se pudieron generar los criterios de aceptación');
  });

  it('discard() clears only the draft and keeps the provenance and error', async () => {
    api.generate.mockReturnValue(of(generated()));
    await store.generate(10, 55, ['A']);
    store.error.set('algo');

    store.discard();

    expect(store.draft()).toBeNull();
    expect(store.model()).toBe('llama3');
    expect(store.error()).toBe('algo');
  });

  it('setDraft replaces the editable draft rows', async () => {
    api.generate.mockReturnValue(of(generated()));
    await store.generate(10, 55, ['A']);

    store.setDraft(['A', 'editado']);

    expect(store.draft()).toEqual(['A', 'editado']);
  });
});
