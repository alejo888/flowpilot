import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CONFIRM_TIMEOUT_MS } from '../../core/api/latest-request';
import { AiSubtasksApiService } from './ai-subtasks.api';
import { GeneratedSubtasksResponse } from './ai-subtasks.model';
import { AiSubtasksStore } from './ai-subtasks.store';

function generated(overrides: Partial<GeneratedSubtasksResponse> = {}): GeneratedSubtasksResponse {
  return {
    subtasks: [
      { title: 'Subtarea A', description: 'Descripción A' },
      { title: 'Subtarea B', description: 'Descripción B' },
    ],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

describe('AiSubtasksStore', () => {
  let api: {
    generateSubtasks: ReturnType<typeof vi.fn>;
    createBatch: ReturnType<typeof vi.fn>;
  };
  let store: AiSubtasksStore;

  beforeEach(() => {
    api = { generateSubtasks: vi.fn(), createBatch: vi.fn() };
    TestBed.configureTestingModule({
      providers: [AiSubtasksStore, { provide: AiSubtasksApiService, useValue: api }],
    });
    store = TestBed.inject(AiSubtasksStore);
  });

  it('populates the generated list and provenance on a successful generate', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));

    const ok = await store.generate(10, { workItemId: 55 });

    expect(ok).toBe(true);
    expect(api.generateSubtasks).toHaveBeenCalledWith(10, { workItemId: 55 });
    expect(store.generated()).toEqual([
      { title: 'Subtarea A', description: 'Descripción A' },
      { title: 'Subtarea B', description: 'Descripción B' },
    ]);
    expect(store.generatedBy()).toBe('OLLAMA');
    expect(store.model()).toBe('llama3');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('surfaces the backend detail and keeps the generated list null when generate fails', async () => {
    api.generateSubtasks.mockReturnValue(
      throwError(() => ({ error: { detail: 'El asistente de IA no está disponible en este momento.' } })),
    );

    const ok = await store.generate(10, { storyText: 'algo' });

    expect(ok).toBe(false);
    expect(store.error()).toBe('El asistente de IA no está disponible en este momento.');
    expect(store.generated()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('falls back to a generic message when the backend detail is missing', async () => {
    api.generateSubtasks.mockReturnValue(throwError(() => ({})));

    await store.generate(10, { storyText: 'algo' });

    expect(store.error()).toBe('No se pudieron generar las subtareas');
  });

  it('creates the batch, clears the generated state and resolves true on success', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 55 });
    api.createBatch.mockReturnValue(of([{ id: 1 }, { id: 2 }]));

    const request = {
      columnId: 3,
      parentWorkItemId: 55,
      aiGenerated: true,
      aiModel: 'llama3',
      subtasks: [{ title: 'A', description: '' }],
    };
    const ok = await store.confirm(10, request);

    expect(ok).toBe(true);
    expect(api.createBatch).toHaveBeenCalledWith(10, request);
    expect(store.generated()).toBeNull();
    expect(store.success()).not.toBeNull();
    expect(store.submitting()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps the generated list and surfaces the detail when the batch fails', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 55 });
    api.createBatch.mockReturnValue(
      throwError(() => ({ error: { detail: 'La columna no pertenece al proyecto' } })),
    );

    const ok = await store.confirm(10, { columnId: 3, subtasks: [{ title: 'A' }] });

    expect(ok).toBe(false);
    expect(store.error()).toBe('La columna no pertenece al proyecto');
    expect(store.generated()).not.toBeNull();
    expect(store.submitting()).toBe(false);
  });

  it('falls back to a generic message when the batch error has no detail', async () => {
    api.createBatch.mockReturnValue(throwError(() => ({})));

    await store.confirm(10, { columnId: 3, subtasks: [{ title: 'A' }] });

    expect(store.error()).toBe('No se pudieron crear las subtareas');
  });

  it('resets the generated state', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 1 });

    store.reset();

    expect(store.generated()).toBeNull();
    expect(store.generatedBy()).toBeNull();
    expect(store.model()).toBeNull();
  });

  it('reset() clears loading, submitting and error', () => {
    api.generateSubtasks.mockReturnValue(new Subject());
    void store.generate(10, { workItemId: 1 });
    store.error.set('algo');

    store.reset();

    expect(store.loading()).toBe(false);
    expect(store.submitting()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('ignores a generate response that lands after reset()', async () => {
    const response = new Subject<GeneratedSubtasksResponse>();
    api.generateSubtasks.mockReturnValue(response);
    const pending = store.generate(10, { workItemId: 1 });

    store.reset();
    response.next(generated());

    expect(await pending).toBe(false);
    expect(store.generated()).toBeNull();
    expect(store.model()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('ignores a generate error that lands after reset()', async () => {
    const response = new Subject<GeneratedSubtasksResponse>();
    api.generateSubtasks.mockReturnValue(response);
    const pending = store.generate(10, { workItemId: 1 });

    store.reset();
    response.error({ error: { detail: 'tarde' } });

    expect(await pending).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('ignores a superseded generate response', async () => {
    const first = new Subject<GeneratedSubtasksResponse>();
    const second = new Subject<GeneratedSubtasksResponse>();
    api.generateSubtasks.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const firstRun = store.generate(10, { workItemId: 1 });
    const secondRun = store.generate(10, { workItemId: 2 });

    second.next(generated({ model: 'nuevo' }));
    first.next(generated({ model: 'viejo' }));

    expect(await secondRun).toBe(true);
    expect(await firstRun).toBe(false);
    expect(store.model()).toBe('nuevo');
  });

  it('keeps an in-flight confirm across reset(): its success still lands and leaves the draft cleared', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 1 });
    const response = new Subject<unknown>();
    api.createBatch.mockReturnValue(response);
    const pending = store.confirm(10, { columnId: 3, subtasks: [{ title: 'A' }] });

    store.reset();
    expect(store.generated()).toBeNull();
    expect(store.submitting()).toBe(true);
    api.generateSubtasks.mockClear();
    expect(await store.generate(11, { storyText: 'otra' })).toBe(false);
    expect(api.generateSubtasks).not.toHaveBeenCalled();

    response.next([]);

    expect(await pending).toBe(true);
    expect(store.success()).toBe('Subtareas creadas.');
    expect(store.generated()).toBeNull();
    expect(store.model()).toBeNull();
    expect(store.submitting()).toBe(false);
  });

  it('surfaces a confirm error that lands after reset()', async () => {
    const response = new Subject<unknown>();
    api.createBatch.mockReturnValue(response);
    const pending = store.confirm(10, { columnId: 3, subtasks: [{ title: 'A' }] });

    store.reset();
    response.error({ error: { detail: 'Sin permiso' } });

    expect(await pending).toBe(false);
    expect(store.error()).toBe('Sin permiso');
    expect(store.submitting()).toBe(false);
  });

  it('rejects generate without a request while a confirm is in flight', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 55 });
    api.generateSubtasks.mockClear();
    api.createBatch.mockReturnValue(new Subject<unknown>().asObservable());
    void store.confirm(10, { columnId: 1, subtasks: [{ title: 'A' }] });

    const ok = await store.generate(10, { workItemId: 55 });

    expect(ok).toBe(false);
    expect(api.generateSubtasks).not.toHaveBeenCalled();
    expect(store.submitting()).toBe(true);
    expect(store.generated()).not.toBeNull();
  });

  it('rejects confirm without a request while a generate is in flight', async () => {
    api.generateSubtasks.mockReturnValue(new Subject<GeneratedSubtasksResponse>().asObservable());
    void store.generate(10, { workItemId: 55 });

    const ok = await store.confirm(10, { columnId: 1, subtasks: [{ title: 'A' }] });

    expect(ok).toBe(false);
    expect(api.createBatch).not.toHaveBeenCalled();
    expect(store.loading()).toBe(true);
  });
  it('a hung confirm times out: submitting clears, the drafts stay and the screen is usable again', async () => {
    vi.useFakeTimers();
    try {
      api.generateSubtasks.mockReturnValue(of(generated()));
      await store.generate(10, { workItemId: 55 });
      api.createBatch.mockReturnValue(new Subject<unknown>().asObservable());

      const result = store.confirm(10, { columnId: 3, subtasks: [{ title: 'A' }] });
      vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);

      expect(await result).toBe(false);
      expect(store.submitting()).toBe(false);
      expect(store.error()).toBe(
        'La operación está tardando demasiado. Es posible que se haya completado: revisa el tablero antes de volver a intentarlo.',
      );
      expect(store.success()).toBeNull();
      expect(store.generated()).toHaveLength(2);
      expect(await store.generate(10, { workItemId: 55 })).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
