import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

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
});
