import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CONFIRM_TIMEOUT_MS } from '../../core/api/latest-request';
import { AiProjectsApiService } from './ai-projects.api';
import { ProjectDraftResponse, ProjectWithBacklogRequest } from './ai-projects.model';
import { AiProjectsStore } from './ai-projects.store';

function draft(overrides: Partial<ProjectDraftResponse> = {}): ProjectDraftResponse {
  return {
    name: 'Tienda',
    description: 'Una tienda',
    technologies: 'Angular',
    epics: [{ title: 'Catálogo', description: null, stories: [{ title: 'Listar', description: null }] }],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

const request: ProjectWithBacklogRequest = {
  name: 'Tienda',
  description: null,
  code: null,
  technologies: null,
  epics: [],
  aiGenerated: true,
  aiModel: 'llama3',
};

describe('AiProjectsStore', () => {
  let api: { generateDraft: ReturnType<typeof vi.fn>; createProjectWithBacklog: ReturnType<typeof vi.fn> };
  let store: AiProjectsStore;

  beforeEach(() => {
    api = { generateDraft: vi.fn(), createProjectWithBacklog: vi.fn() };
    TestBed.configureTestingModule({
      providers: [AiProjectsStore, { provide: AiProjectsApiService, useValue: api }],
    });
    store = TestBed.inject(AiProjectsStore);
  });

  it('populates the draft and provenance on a successful generate', async () => {
    api.generateDraft.mockReturnValue(of(draft()));

    const ok = await store.generate('Una tienda online');

    expect(ok).toBe(true);
    expect(api.generateDraft).toHaveBeenCalledWith({ description: 'Una tienda online' });
    expect(store.draft()?.name).toBe('Tienda');
    expect(store.generatedBy()).toBe('OLLAMA');
    expect(store.model()).toBe('llama3');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('surfaces the Spanish detail on a failed generate and leaves no draft', async () => {
    api.generateDraft.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { detail: 'El asistente de IA no está disponible en este momento.' },
          }),
      ),
    );

    const ok = await store.generate('x');

    expect(ok).toBe(false);
    expect(store.error()).toBe('El asistente de IA no está disponible en este momento.');
    expect(store.draft()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('falls back to a generic message when the error has no detail', async () => {
    api.generateDraft.mockReturnValue(throwError(() => new Error('boom')));

    await store.generate('x');

    expect(store.error()).toBe('No se pudo generar la propuesta de proyecto');
  });

  it('ignores a generate response that lands after reset()', async () => {
    const pending = new Subject<ProjectDraftResponse>();
    api.generateDraft.mockReturnValue(pending);

    const result = store.generate('x');
    store.reset();
    pending.next(draft());
    pending.complete();

    expect(await result).toBe(false);
    expect(store.draft()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('ignores a generate error that lands after reset()', async () => {
    const pending = new Subject<ProjectDraftResponse>();
    api.generateDraft.mockReturnValue(pending);

    const result = store.generate('x');
    store.reset();
    pending.error(new HttpErrorResponse({ status: 503, error: { detail: 'late' } }));

    expect(await result).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('a newer generate wins over an older response', async () => {
    const first = new Subject<ProjectDraftResponse>();
    api.generateDraft.mockReturnValueOnce(first).mockReturnValueOnce(of(draft({ name: 'Nuevo' })));

    const older = store.generate('a');
    await store.generate('b');
    first.next(draft({ name: 'Viejo' }));

    expect(await older).toBe(false);
    expect(store.draft()?.name).toBe('Nuevo');
  });

  it('reset() is ignored while a confirm is in flight and a late failure keeps the draft', async () => {
    api.generateDraft.mockReturnValue(of(draft()));
    await store.generate('x');
    const pending = new Subject<{ id: number }>();
    api.createProjectWithBacklog.mockReturnValue(pending);

    const result = store.confirm(request);
    store.reset();
    expect(store.draft()).not.toBeNull();
    expect(store.submitting()).toBe(true);

    pending.error(new HttpErrorResponse({ status: 409, error: { detail: 'Código duplicado' } }));

    expect(await result).toBe(false);
    expect(store.draft()).not.toBeNull();
    expect(store.codeError()).toBe('Código duplicado');
  });

  it('restart() keeps an in-flight confirm: its success still lands with the created id', async () => {
    api.generateDraft.mockReturnValue(of(draft()));
    await store.generate('x');
    const pending = new Subject<{ id: number }>();
    api.createProjectWithBacklog.mockReturnValue(pending);

    const result = store.confirm(request);
    store.restart();
    expect(store.draft()).toBeNull();
    expect(store.submitting()).toBe(true);
    api.generateDraft.mockClear();
    expect(await store.generate('otra')).toBe(false);
    expect(api.generateDraft).not.toHaveBeenCalled();

    pending.next({ id: 9 });
    pending.complete();

    expect(await result).toBe(true);
    expect(store.createdProjectId()).toBe(9);
    expect(store.submitting()).toBe(false);
    expect(store.draft()).toBeNull();
  });

  it('confirm resolves true, exposes the created id and clears the draft', async () => {
    api.generateDraft.mockReturnValue(of(draft()));
    await store.generate('x');
    api.createProjectWithBacklog.mockReturnValue(of({ id: 42 }));

    const ok = await store.confirm(request);

    expect(ok).toBe(true);
    expect(api.createProjectWithBacklog).toHaveBeenCalledWith(request);
    expect(store.createdProjectId()).toBe(42);
    expect(store.draft()).toBeNull();
    expect(store.submitting()).toBe(false);
  });

  it('confirm failure keeps the draft and surfaces the detail plus field errors', async () => {
    api.generateDraft.mockReturnValue(of(draft()));
    await store.generate('x');
    api.createProjectWithBacklog.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { detail: 'Datos inválidos', errors: { 'epics[0].title': 'El título es obligatorio' } },
          }),
      ),
    );

    const ok = await store.confirm(request);

    expect(ok).toBe(false);
    expect(store.draft()).not.toBeNull();
    expect(store.error()).toBe('Datos inválidos');
    expect(store.fieldErrors()).toEqual({ 'epics[0].title': 'El título es obligatorio' });
    expect(store.codeError()).toBeNull();
    expect(store.createdProjectId()).toBeNull();
  });

  it('maps a 409 to the code field error only', async () => {
    api.createProjectWithBacklog.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'El código ya existe' } })),
    );

    const ok = await store.confirm(request);

    expect(ok).toBe(false);
    expect(store.codeError()).toBe('El código ya existe');
    expect(store.error()).toBeNull();
  });

  it('clears previous errors when a new confirm starts', async () => {
    api.createProjectWithBacklog.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'dup' } })),
    );
    await store.confirm(request);
    api.createProjectWithBacklog.mockReturnValueOnce(of({ id: 1 }));

    await store.confirm(request);

    expect(store.codeError()).toBeNull();
  });

  it('rejects generate without a request while a confirm is in flight', async () => {
    api.generateDraft.mockReturnValue(of(draft()));
    await store.generate('Una tienda online');
    api.generateDraft.mockClear();
    api.createProjectWithBacklog.mockReturnValue(new Subject<{ id: number }>().asObservable());
    void store.confirm(request);

    const ok = await store.generate('Otra tienda');

    expect(ok).toBe(false);
    expect(api.generateDraft).not.toHaveBeenCalled();
    expect(store.submitting()).toBe(true);
    expect(store.draft()?.name).toBe('Tienda');
  });

  it('rejects confirm without a request while a generate is in flight', async () => {
    api.generateDraft.mockReturnValue(new Subject<ProjectDraftResponse>().asObservable());
    void store.generate('Una tienda online');

    const ok = await store.confirm(request);

    expect(ok).toBe(false);
    expect(api.createProjectWithBacklog).not.toHaveBeenCalled();
    expect(store.loading()).toBe(true);
  });
  it('a hung confirm times out: submitting clears, the draft stays and the screen is usable again', async () => {
    vi.useFakeTimers();
    try {
      api.generateDraft.mockReturnValue(of(draft()));
      await store.generate('x');
      api.createProjectWithBacklog.mockReturnValue(new Subject<{ id: number }>().asObservable());

      const result = store.confirm(request);
      vi.advanceTimersByTime(CONFIRM_TIMEOUT_MS);

      expect(await result).toBe(false);
      expect(store.submitting()).toBe(false);
      expect(store.error()).toBe(
        'La operación está tardando demasiado. Es posible que se haya completado: revisa la lista de proyectos antes de volver a intentarlo.',
      );
      expect(store.draft()?.name).toBe('Tienda');
      expect(store.createdProjectId()).toBeNull();
      api.generateDraft.mockReturnValue(of(draft({ name: 'Otra' })));
      expect(await store.generate('otra')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
