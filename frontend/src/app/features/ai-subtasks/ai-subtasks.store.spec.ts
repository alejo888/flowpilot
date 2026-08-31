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
  let api: { generateSubtasks: ReturnType<typeof vi.fn> };
  let store: AiSubtasksStore;

  beforeEach(() => {
    api = { generateSubtasks: vi.fn() };
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

  it('resets the generated state', async () => {
    api.generateSubtasks.mockReturnValue(of(generated()));
    await store.generate(10, { workItemId: 1 });

    store.reset();

    expect(store.generated()).toBeNull();
    expect(store.generatedBy()).toBeNull();
    expect(store.model()).toBeNull();
  });
});
