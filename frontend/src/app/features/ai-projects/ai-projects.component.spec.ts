import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AiProjectsApiService } from './ai-projects.api';
import { AiProjectsComponent } from './ai-projects.component';
import { ProjectDraftResponse } from './ai-projects.model';

function draft(overrides: Partial<ProjectDraftResponse> = {}): ProjectDraftResponse {
  return {
    name: 'Tienda online',
    description: 'Una tienda para vender',
    technologies: 'Angular, Spring',
    epics: [
      {
        title: 'Catálogo',
        description: 'Productos',
        stories: [
          { title: 'Listar productos', description: 'Ver el listado' },
          { title: 'Buscar productos', description: null },
        ],
      },
      { title: 'Pagos', description: null, stories: [] },
    ],
    generatedBy: 'OLLAMA',
    model: 'llama3',
    ...overrides,
  };
}

describe('AiProjectsComponent', () => {
  let fixture: ComponentFixture<AiProjectsComponent>;
  let api: { generateDraft: ReturnType<typeof vi.fn>; createProjectWithBacklog: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null =>
    (fixture.nativeElement as HTMLElement).querySelector<T>(`[data-testid="${testid}"]`);

  function setValue(testid: string, value: string): void {
    const el = q<HTMLInputElement | HTMLTextAreaElement>(testid) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function click(testid: string): void {
    (q(testid) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function generateDraft(response = draft()): Promise<void> {
    api.generateDraft.mockReturnValue(of(response));
    setValue('ai-project-description', 'Quiero una tienda online');
    click('ai-project-generate');
    await settle();
  }

  beforeEach(async () => {
    api = { generateDraft: vi.fn(), createProjectWithBacklog: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AiProjectsComponent],
      providers: [provideRouter([]), { provide: AiProjectsApiService, useValue: api }],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as never;
    fixture = TestBed.createComponent(AiProjectsComponent);
    fixture.detectChanges();
  });

  describe('step 1', () => {
    it('disables generate while the description is blank and enables it once typed', () => {
      expect((q('ai-project-generate') as HTMLButtonElement).disabled).toBe(true);
      setValue('ai-project-description', '   ');
      expect((q('ai-project-generate') as HTMLButtonElement).disabled).toBe(true);
      setValue('ai-project-description', 'Una app');
      expect((q('ai-project-generate') as HTMLButtonElement).disabled).toBe(false);
    });

    it('caps the description at 2000 characters and shows a counter', () => {
      expect(q('ai-project-description')?.getAttribute('maxlength')).toBe('2000');
      setValue('ai-project-description', 'abcd');
      expect(q('ai-project-counter')?.textContent).toContain('4 / 2000');
    });

    it('sends the trimmed description and moves to the draft step', async () => {
      api.generateDraft.mockReturnValue(of(draft()));
      setValue('ai-project-description', '  Quiero una tienda  ');
      click('ai-project-generate');
      await settle();

      expect(api.generateDraft).toHaveBeenCalledWith({ description: 'Quiero una tienda' });
      expect(q('ai-project-name')).toBeTruthy();
    });

    it('shows the backend error in an alert and keeps the typed description on failure', async () => {
      api.generateDraft.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'IA no disponible' } })),
      );
      setValue('ai-project-description', 'Una app');
      click('ai-project-generate');
      await settle();

      expect(q('ai-project-error')?.getAttribute('role')).toBe('alert');
      expect(q('ai-project-error')?.textContent).toContain('IA no disponible');
      expect((q('ai-project-description') as HTMLTextAreaElement).value).toBe('Una app');
      expect(q('ai-project-name')).toBeNull();
    });
  });

  describe('step 2', () => {
    it('seeds the editable fields and the epics tree from the draft', async () => {
      await generateDraft();

      expect((q('ai-project-name') as HTMLInputElement).value).toBe('Tienda online');
      expect((q('ai-project-technologies') as HTMLInputElement).value).toBe('Angular, Spring');
      expect((q('ai-epic-title-0') as HTMLInputElement).value).toBe('Catálogo');
      expect((q('ai-story-title-0-1') as HTMLInputElement).value).toBe('Buscar productos');
      expect((q('ai-epic-title-1') as HTMLInputElement).value).toBe('Pagos');
      expect(q('ai-project-provenance')?.textContent).toContain('OLLAMA');
    });

    it('adds and removes epics and stories', async () => {
      await generateDraft();

      click('ai-epic-add');
      expect(q('ai-epic-title-2')).toBeTruthy();
      click('ai-story-add-1');
      expect(q('ai-story-title-1-0')).toBeTruthy();
      click('ai-story-remove-0-0');
      expect((q('ai-story-title-0-0') as HTMLInputElement).value).toBe('Buscar productos');
      click('ai-epic-remove-0');
      expect((q('ai-epic-title-0') as HTMLInputElement).value).toBe('Pagos');
    });

    it('disables add-epic at 10 epics and add-story at 10 stories per epic', async () => {
      await generateDraft();
      for (let i = 0; i < 8; i++) {
        click('ai-epic-add');
      }
      expect(q('ai-epic-title-9')).toBeTruthy();
      expect((q('ai-epic-add') as HTMLButtonElement).disabled).toBe(true);

      for (let i = 0; i < 10; i++) {
        click('ai-story-add-1');
      }
      expect((q('ai-story-add-1') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables both add buttons once the 50-item total is reached', async () => {
      // 5 epics x 9 stories = 50 items.
      const epics = Array.from({ length: 5 }, (_, i) => ({
        title: `Epic ${i}`,
        description: null,
        stories: Array.from({ length: 9 }, (_, j) => ({ title: `S${i}-${j}`, description: null })),
      }));
      await generateDraft(draft({ epics }));

      expect((q('ai-epic-add') as HTMLButtonElement).disabled).toBe(true);
      expect((q('ai-story-add-0') as HTMLButtonElement).disabled).toBe(true);
    });

    it('blocks confirm and shows a hint while a title or the name is blank', async () => {
      await generateDraft();
      expect((q('ai-project-confirm') as HTMLButtonElement).disabled).toBe(false);
      expect(q('ai-project-blank-hint')).toBeNull();

      setValue('ai-story-title-0-0', '   ');
      expect((q('ai-project-confirm') as HTMLButtonElement).disabled).toBe(true);
      expect(q('ai-project-blank-hint')).toBeTruthy();

      setValue('ai-story-title-0-0', 'Listar');
      expect((q('ai-project-confirm') as HTMLButtonElement).disabled).toBe(false);

      setValue('ai-project-name', '');
      expect((q('ai-project-confirm') as HTMLButtonElement).disabled).toBe(true);
    });

    it('posts the edited payload with provenance and navigates to the new board', async () => {
      await generateDraft();
      api.createProjectWithBacklog.mockReturnValue(of({ id: 77 }));
      setValue('ai-project-name', '  Mi tienda ');
      setValue('ai-project-code', 'TIENDA-1');
      setValue('ai-epic-title-1', 'Cobros');
      click('ai-project-confirm');
      await settle();

      expect(api.createProjectWithBacklog).toHaveBeenCalledWith({
        name: 'Mi tienda',
        description: 'Una tienda para vender',
        code: 'TIENDA-1',
        technologies: 'Angular, Spring',
        epics: [
          {
            title: 'Catálogo',
            description: 'Productos',
            stories: [
              { title: 'Listar productos', description: 'Ver el listado' },
              { title: 'Buscar productos', description: null },
            ],
          },
          { title: 'Cobros', description: null, stories: [] },
        ],
        aiGenerated: true,
        aiModel: 'llama3',
      });
      expect(navigate).toHaveBeenCalledWith(['/projects', 77, 'board']);
    });

    it('sends a null code when left blank', async () => {
      await generateDraft();
      api.createProjectWithBacklog.mockReturnValue(of({ id: 1 }));
      click('ai-project-confirm');
      await settle();

      expect(api.createProjectWithBacklog.mock.calls[0][0].code).toBeNull();
    });

    it('shows a 409 duplicate code next to the code field and keeps the form', async () => {
      await generateDraft();
      api.createProjectWithBacklog.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Ya existe un proyecto con ese código' } })),
      );
      setValue('ai-project-code', 'DUP');
      setValue('ai-epic-title-0', 'Editada');
      click('ai-project-confirm');
      await settle();

      expect(fixture.nativeElement.textContent).toContain('Ya existe un proyecto con ese código');
      expect(q('ai-project-code')?.getAttribute('aria-invalid')).toBe('true');
      expect((q('ai-project-code') as HTMLInputElement).value).toBe('DUP');
      expect((q('ai-epic-title-0') as HTMLInputElement).value).toBe('Editada');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('shows a generic error alert with field errors and keeps the edits on a 400', async () => {
      await generateDraft();
      api.createProjectWithBacklog.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { detail: 'Datos inválidos', errors: { 'epics[0].title': 'Obligatorio' } },
            }),
        ),
      );
      click('ai-project-confirm');
      await settle();

      const alert = q('ai-project-error');
      expect(alert?.getAttribute('role')).toBe('alert');
      expect(alert?.textContent).toContain('Datos inválidos');
      expect(alert?.textContent).toContain('Obligatorio');
      expect((q('ai-project-name') as HTMLInputElement).value).toBe('Tienda online');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('discarding the proposal returns to step 1', async () => {
      await generateDraft();
      click('ai-project-discard');

      expect(q('ai-project-name')).toBeNull();
      expect(q('ai-project-generate')).toBeTruthy();
    });
  });

  it('offers a link back to the projects list', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/projects"]');
    expect(link).toBeTruthy();
  });
});
