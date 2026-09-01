import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

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
});
