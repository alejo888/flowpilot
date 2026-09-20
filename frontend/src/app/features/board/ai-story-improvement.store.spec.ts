import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { GeneratedUserStoryResponse } from '../ai-stories/ai-stories.model';
import { AiStoryImprovementApiService } from './ai-story-improvement.api';
import { AiStoryImprovementStore } from './ai-story-improvement.store';

function improved(overrides: Partial<GeneratedUserStoryResponse> = {}): GeneratedUserStoryResponse {
  return {
    userStory: { role: 'PM', action: 'ver', benefit: 'decidir', text: 'Como PM quiero ver para decidir' },
    acceptanceCriteria: ['Criterio 1', 'Criterio 2'],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

describe('AiStoryImprovementStore', () => {
  let api: { improve: ReturnType<typeof vi.fn> };
  let store: AiStoryImprovementStore;

  beforeEach(() => {
    api = { improve: vi.fn() };
    TestBed.configureTestingModule({
      providers: [AiStoryImprovementStore, { provide: AiStoryImprovementApiService, useValue: api }],
    });
    store = TestBed.inject(AiStoryImprovementStore);
  });

  it('stores the suggested description and criteria on success', async () => {
    api.improve.mockReturnValue(of(improved()));

    const ok = await store.generate(10, 55);

    expect(ok).toBe(true);
    expect(api.improve).toHaveBeenCalledWith(10, 55);
    expect(store.suggestion()).toEqual({
      description: 'Como PM quiero ver para decidir',
      criteria: ['Criterio 1', 'Criterio 2'],
    });
    expect(store.model()).toBe('llama3');
    expect(store.generatedBy()).toBe('OLLAMA');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('resolves false, surfaces the Spanish detail and leaves no suggestion on failure', async () => {
    api.improve.mockReturnValue(
      throwError(() => ({ error: { detail: 'El asistente de IA no está disponible en este momento.' } })),
    );

    const ok = await store.generate(10, 55);

    expect(ok).toBe(false);
    expect(store.suggestion()).toBeNull();
    expect(store.error()).toBe('El asistente de IA no está disponible en este momento.');
    expect(store.loading()).toBe(false);
  });

  it('keeps an on-screen suggestion when a later generation fails (no discard on failure)', async () => {
    api.improve.mockReturnValueOnce(of(improved()));
    await store.generate(10, 55);
    api.improve.mockReturnValueOnce(throwError(() => ({})));

    const ok = await store.generate(10, 55);

    expect(ok).toBe(false);
    expect(store.suggestion()?.description).toBe('Como PM quiero ver para decidir');
    expect(store.error()).toBe('No se pudo mejorar la historia');
  });

  it('discard() clears only the suggestion', async () => {
    api.improve.mockReturnValue(of(improved()));
    await store.generate(10, 55);
    store.error.set('algo');

    store.discard();

    expect(store.suggestion()).toBeNull();
    expect(store.error()).toBe('algo');
  });

  it('reset() clears the stale suggestion and error', async () => {
    api.improve.mockReturnValue(of(improved()));
    await store.generate(10, 55);
    store.error.set('algo');

    store.reset();

    expect(store.suggestion()).toBeNull();
    expect(store.error()).toBeNull();
  });
});
