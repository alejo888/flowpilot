import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CONFIRM_TIMEOUT_MS } from '../../core/api/latest-request';
import { BoardApiService } from '../board/board-api.service';
import { AiStoriesApiService } from './ai-stories.api';
import { GeneratedUserStoryResponse } from './ai-stories.model';
import { AiStoriesStore } from './ai-stories.store';

function generated(overrides: Partial<GeneratedUserStoryResponse> = {}): GeneratedUserStoryResponse {
  return {
    userStory: {
      role: 'usuario registrado',
      action: 'exportar mis tareas',
      benefit: 'compartirlas con mi equipo',
      text: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
    },
    acceptanceCriteria: ['Criterio A', 'Criterio B'],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

describe('AiStoriesStore', () => {
  let api: { generateUserStory: ReturnType<typeof vi.fn> };
  let board: { createWorkItem: ReturnType<typeof vi.fn> };
  let store: AiStoriesStore;

  beforeEach(() => {
    api = { generateUserStory: vi.fn() };
    board = { createWorkItem: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        AiStoriesStore,
        { provide: AiStoriesApiService, useValue: api },
        { provide: BoardApiService, useValue: board },
      ],
    });
    store = TestBed.inject(AiStoriesStore);
  });

  it('populates the draft, criteria and provenance on a successful generate', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));

    const ok = await store.generate(10, 'Necesito exportar tareas');

    expect(ok).toBe(true);
    expect(api.generateUserStory).toHaveBeenCalledWith(10, { requirement: 'Necesito exportar tareas' });
    expect(store.draft()?.text).toContain('Como usuario registrado quiero');
    expect(store.criteria()).toEqual(['Criterio A', 'Criterio B']);
    expect(store.generatedBy()).toBe('OLLAMA');
    expect(store.model()).toBe('llama3');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('surfaces the backend detail and keeps the draft empty when generate fails', async () => {
    api.generateUserStory.mockReturnValue(
      throwError(() => ({ error: { detail: 'El asistente de IA no está disponible en este momento.' } })),
    );

    const ok = await store.generate(10, 'algo');

    expect(ok).toBe(false);
    expect(store.error()).toBe('El asistente de IA no está disponible en este momento.');
    expect(store.draft()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('falls back to a generic message when the backend detail is missing', async () => {
    api.generateUserStory.mockReturnValue(throwError(() => ({})));

    await store.generate(10, 'algo');

    expect(store.error()).toBe('No se pudo generar la historia de usuario');
  });

  it('confirms by creating a work item with the edited fields and AI provenance', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    board.createWorkItem.mockReturnValue(of({ id: 99 }));

    const ok = await store.confirm(10, {
      title: 'Exportar tareas a CSV',
      description: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
      acceptanceCriteria: ['Criterio A editado', 'Criterio B'],
    });

    expect(ok).toBe(true);
    expect(board.createWorkItem).toHaveBeenCalledWith(10, {
      title: 'Exportar tareas a CSV',
      description: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
      acceptanceCriteria: ['Criterio A editado', 'Criterio B'],
      aiGenerated: true,
      aiModel: 'llama3',
    });
    expect(store.success()).not.toBeNull();
  });

  it('sends aiModel null when confirming a STUB draft', async () => {
    api.generateUserStory.mockReturnValue(of(generated({ generatedBy: 'STUB', model: null })));
    await store.generate(10, 'algo');
    board.createWorkItem.mockReturnValue(of({ id: 1 }));

    await store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });

    expect(board.createWorkItem).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ aiGenerated: true, aiModel: null }),
    );
  });

  it('resolves false and surfaces the error when confirm fails, without clearing the draft', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    board.createWorkItem.mockReturnValue(throwError(() => ({ error: { detail: 'Sin permiso' } })));

    const ok = await store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });

    expect(ok).toBe(false);
    expect(store.error()).toBe('Sin permiso');
    expect(store.submitting()).toBe(false);
    expect(store.draft()).not.toBeNull();
  });

  it('ignores a generate response that lands after reset (e.g. the user left the screen)', async () => {
    const pending = new Subject<GeneratedUserStoryResponse>();
    api.generateUserStory.mockReturnValue(pending.asObservable());

    const result = store.generate(10, 'algo');
    store.reset();
    pending.next(generated());
    pending.complete();

    expect(await result).toBe(false);
    expect(store.draft()).toBeNull();
    expect(store.criteria()).toEqual([]);
    expect(store.model()).toBeNull();
  });

  it('ignores a generate error that lands after reset', async () => {
    const pending = new Subject<GeneratedUserStoryResponse>();
    api.generateUserStory.mockReturnValue(pending.asObservable());

    const result = store.generate(10, 'algo');
    store.reset();
    pending.error({ error: { detail: 'El asistente de IA no está disponible en este momento.' } });

    expect(await result).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('clears loading, error and success on reset', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    board.createWorkItem.mockReturnValue(of({ id: 1 }));
    await store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });
    expect(store.success()).not.toBeNull();
    api.generateUserStory.mockReturnValue(new Subject<GeneratedUserStoryResponse>().asObservable());
    void store.generate(10, 'otra');

    store.reset();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.success()).toBeNull();
  });

  it('keeps an in-flight confirm across reset: its success still lands and no stale draft reappears', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    const pending = new Subject<{ id: number }>();
    board.createWorkItem.mockReturnValue(pending.asObservable());

    const result = store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });
    store.reset();
    expect(store.draft()).toBeNull();
    expect(store.submitting()).toBe(true);
    api.generateUserStory.mockClear();
    expect(await store.generate(20, 'otra visita')).toBe(false);
    expect(api.generateUserStory).not.toHaveBeenCalled();

    pending.next({ id: 1 });
    pending.complete();

    expect(await result).toBe(true);
    expect(store.success()).toBe('Tarea creada a partir de la historia generada.');
    expect(store.draft()).toBeNull();
    expect(store.model()).toBeNull();
    expect(store.submitting()).toBe(false);
  });

  it('surfaces a confirm error that lands after reset', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    const pending = new Subject<{ id: number }>();
    board.createWorkItem.mockReturnValue(pending.asObservable());

    const result = store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });
    store.reset();
    pending.error({ error: { detail: 'Sin permiso' } });

    expect(await result).toBe(false);
    expect(store.error()).toBe('Sin permiso');
    expect(store.submitting()).toBe(false);
  });

  it('rejects generate without a request while a confirm is in flight', async () => {
    api.generateUserStory.mockReturnValue(of(generated()));
    await store.generate(10, 'algo');
    api.generateUserStory.mockClear();
    board.createWorkItem.mockReturnValue(new Subject<{ id: number }>().asObservable());
    void store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });

    const ok = await store.generate(10, 'otra cosa');

    expect(ok).toBe(false);
    expect(api.generateUserStory).not.toHaveBeenCalled();
    expect(store.submitting()).toBe(true);
    expect(store.draft()).not.toBeNull();
  });

  it('rejects confirm without a request while a generate is in flight', async () => {
    api.generateUserStory.mockReturnValue(new Subject<GeneratedUserStoryResponse>().asObservable());
    void store.generate(10, 'algo');

    const ok = await store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });

    expect(ok).toBe(false);
    expect(board.createWorkItem).not.toHaveBeenCalled();
    expect(store.loading()).toBe(true);
  });
  it('a hung confirm times out: submitting clears, the draft stays and the screen is usable again', async () => {
    vi.useFakeTimers();
    try {
      api.generateUserStory.mockReturnValue(of(generated()));
      await store.generate(10, 'algo');
      board.createWorkItem.mockReturnValue(new Subject<{ id: number }>().asObservable());

      const result = store.confirm(10, { title: 'T', description: 'D', acceptanceCriteria: [] });
      vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);

      expect(await result).toBe(false);
      expect(store.submitting()).toBe(false);
      expect(store.error()).toBe(
        'La operación está tardando demasiado. Es posible que se haya completado: revisa el tablero antes de volver a intentarlo.',
      );
      expect(store.success()).toBeNull();
      expect(store.draft()).not.toBeNull();
      expect(store.criteria()).toEqual(['Criterio A', 'Criterio B']);
      expect(await store.generate(10, 'otra')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
