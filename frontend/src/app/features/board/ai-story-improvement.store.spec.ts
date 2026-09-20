import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

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

  it('discard() clears the suggestion and a stale error left by a later failed generate', async () => {
    api.improve.mockReturnValueOnce(of(improved()));
    await store.generate(10, 55);
    api.improve.mockReturnValueOnce(throwError(() => ({})));
    await store.generate(10, 55);
    expect(store.suggestion()).not.toBeNull();
    expect(store.error()).not.toBeNull();

    store.discard();

    expect(store.suggestion()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('discard() does not invalidate an in-flight generate', async () => {
    const pending = new Subject<GeneratedUserStoryResponse>();
    api.improve.mockReturnValue(pending);
    const p = store.generate(10, 55);

    store.discard();
    pending.next(improved());
    pending.complete();

    expect(await p).toBe(true);
    expect(store.suggestion()).not.toBeNull();
  });

  it('reset() clears the stale suggestion and error', async () => {
    api.improve.mockReturnValue(of(improved()));
    await store.generate(10, 55);
    store.error.set('algo');

    store.reset();

    expect(store.suggestion()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('ignores a late success after reset() and resolves false', async () => {
    const pending = new Subject<GeneratedUserStoryResponse>();
    api.improve.mockReturnValue(pending);

    const result = store.generate(10, 55);
    store.reset();
    pending.next(improved());
    pending.complete();

    expect(await result).toBe(false);
    expect(store.suggestion()).toBeNull();
    expect(store.generatedBy()).toBeNull();
    expect(store.model()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('ignores a late error after reset() and resolves false', async () => {
    const pending = new Subject<GeneratedUserStoryResponse>();
    api.improve.mockReturnValue(pending);

    const result = store.generate(10, 55);
    store.reset();
    pending.error({ error: { detail: 'tarde' } });

    expect(await result).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('overlapping generate(): older response neither clears loading nor lands', async () => {
    const first = new Subject<GeneratedUserStoryResponse>();
    const second = new Subject<GeneratedUserStoryResponse>();
    api.improve.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const older = store.generate(10, 55);
    const newer = store.generate(10, 55);
    first.next(improved({ userStory: { role: 'a', action: 'b', benefit: 'c', text: 'vieja' } }));
    first.complete();

    expect(await older).toBe(false);
    expect(store.loading()).toBe(true);
    expect(store.suggestion()).toBeNull();

    second.next(improved({ userStory: { role: 'a', action: 'b', benefit: 'c', text: 'nueva' } }));
    second.complete();

    expect(await newer).toBe(true);
    expect(store.suggestion()?.description).toBe('nueva');
    expect(store.loading()).toBe(false);
  });
});
