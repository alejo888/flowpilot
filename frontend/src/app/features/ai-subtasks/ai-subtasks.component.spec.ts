import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BacklogApiService } from '../backlog/backlog-api.service';
import { Sprint, SprintStatus } from '../backlog/backlog.model';
import { BoardApiService } from '../board/board-api.service';
import { BoardColumn, WorkItem } from '../board/board.model';
import { AiProvider, SubtaskDraft } from './ai-subtasks.model';
import { AiSubtasksComponent } from './ai-subtasks.component';
import { AiSubtasksStore } from './ai-subtasks.store';

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 1,
    projectId: 10,
    columnId: 1,
    title: 'Historia',
    description: null,
    assignedUserId: null,
    assignedUserName: null,
    position: 1024,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function column(id: number, name: string): BoardColumn {
  return { id, name, position: id };
}

function sprint(id: number, name: string, status: SprintStatus): Sprint {
  return {
    id,
    projectId: 10,
    name,
    goal: null,
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const DEFAULT_COLUMNS = [column(1, 'Backlog'), column(2, 'En curso')];

describe('AiSubtasksComponent', () => {
  let fixture: ComponentFixture<AiSubtasksComponent>;
  let storeStub: {
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    success: ReturnType<typeof signal<string | null>>;
    generated: ReturnType<typeof signal<SubtaskDraft[] | null>>;
    generatedBy: ReturnType<typeof signal<AiProvider | null>>;
    model: ReturnType<typeof signal<string | null>>;
    submitting: ReturnType<typeof signal<boolean>>;
    generate: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  let boardApiStub: {
    getWorkItems: ReturnType<typeof vi.fn>;
    getBoardColumns: ReturnType<typeof vi.fn>;
  };
  let backlogApiStub: { listSprints: ReturnType<typeof vi.fn> };

  function build(
    stories: WorkItem[] = [workItem()],
    columns: BoardColumn[] = DEFAULT_COLUMNS,
    sprints: Sprint[] = [],
  ): void {
    boardApiStub = {
      getWorkItems: vi.fn().mockReturnValue(of(stories)),
      getBoardColumns: vi.fn().mockReturnValue(of(columns)),
    };
    backlogApiStub = { listSprints: vi.fn().mockReturnValue(of(sprints)) };
    storeStub = {
      loading: signal(false),
      error: signal<string | null>(null),
      success: signal<string | null>(null),
      generated: signal<SubtaskDraft[] | null>(null),
      generatedBy: signal<AiProvider | null>(null),
      model: signal<string | null>(null),
      submitting: signal(false),
      generate: vi.fn().mockResolvedValue(false),
      confirm: vi.fn().mockResolvedValue(false),
      reset: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AiSubtasksComponent],
      providers: [
        provideRouter([]),
        { provide: AiSubtasksStore, useValue: storeStub },
        { provide: BoardApiService, useValue: boardApiStub },
        { provide: BacklogApiService, useValue: backlogApiStub },
      ],
    });

    fixture = TestBed.createComponent(AiSubtasksComponent);
    fixture.componentRef.setInput('projectId', '10');
  }

  function q(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('defaults to free-text mode (b) when no workItemId query param is present', () => {
    build();
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('text');
    expect(q('subtasks-story-text')).not.toBeNull();
  });

  it('preselects the existing-story mode (a) and the story when ?workItemId= is present', () => {
    build([workItem({ id: 55, title: 'Exportar datos' })]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();

    expect(fixture.componentInstance.mode()).toBe('existing');
    expect(fixture.componentInstance.selectedStoryId()).toBe(55);
    expect(q('subtasks-story-select')).not.toBeNull();
  });

  it('exposes the active mode to assistive tech via aria-pressed', () => {
    build();
    fixture.detectChanges();

    fixture.componentInstance.setMode('text');
    fixture.detectChanges();
    expect(q('mode-text')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('mode-existing')?.getAttribute('aria-pressed')).toBe('false');

    fixture.componentInstance.setMode('existing');
    fixture.detectChanges();
    expect(q('mode-existing')?.getAttribute('aria-pressed')).toBe('true');
    expect(q('mode-text')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles between mode (a) and mode (b)', () => {
    build();
    fixture.detectChanges();

    fixture.componentInstance.setMode('existing');
    fixture.detectChanges();
    expect(q('subtasks-story-select')).not.toBeNull();

    fixture.componentInstance.setMode('text');
    fixture.detectChanges();
    expect(q('subtasks-story-text')).not.toBeNull();
  });

  it('filters the story picker to top-level items (no subtasks)', () => {
    build([
      workItem({ id: 1, title: 'Historia raíz' }),
      workItem({ id: 2, title: 'Subtarea', parentWorkItemId: 1 }),
    ]);
    fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.componentInstance.stories().map((s) => s.id)).toEqual([1]);
  });

  it('renders an editable draft row per generated subtask', () => {
    build();
    fixture.detectChanges();

    storeStub.generated.set([
      { title: 'A', description: 'da' },
      { title: 'B', description: 'db' },
    ]);
    fixture.detectChanges();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="subtask-title-"]').length,
    ).toBe(2);
  });

  it('adds and removes draft rows and caps them at 10', () => {
    build();
    fixture.detectChanges();

    storeStub.generated.set(
      Array.from({ length: 9 }, (_, i) => ({ title: `T${i}`, description: '' })),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    fixture.componentInstance.addDraft();
    expect(fixture.componentInstance.drafts().length).toBe(10);

    // capped
    fixture.componentInstance.addDraft();
    expect(fixture.componentInstance.drafts().length).toBe(10);

    fixture.componentInstance.removeDraft(0);
    expect(fixture.componentInstance.drafts().length).toBe(9);
  });

  it('calls generate immediately for a childless target story (mode a)', async () => {
    build([workItem({ id: 55, childCount: 0 })]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();

    await fixture.componentInstance.generate();

    expect(storeStub.generate).toHaveBeenCalledWith(10, { workItemId: 55 });
    expect(fixture.componentInstance.confirming()).toBe(false);
  });

  it('defers the AI call behind a confirmation dialog naming the count when the story already has subtasks', async () => {
    build([workItem({ id: 55, childCount: 2 })]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();

    await fixture.componentInstance.generate();

    expect(storeStub.generate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirming()).toBe(true);
    fixture.detectChanges();
    expect(q('subtasks-regenerate-dialog')?.textContent).toContain('2 subtareas');

    await fixture.componentInstance.confirmGenerate();
    expect(storeStub.generate).toHaveBeenCalledWith(10, { workItemId: 55 });
    expect(fixture.componentInstance.confirming()).toBe(false);
  });

  it('does not call generate when the confirmation is cancelled', async () => {
    build([workItem({ id: 55, childCount: 3 })]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();

    await fixture.componentInstance.generate();
    fixture.componentInstance.cancelGenerate();

    expect(storeStub.generate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirming()).toBe(false);
  });

  it('generates from free text in mode (b)', async () => {
    build();
    fixture.detectChanges();

    fixture.componentInstance.storyText.set('Como usuario quiero exportar datos');
    await fixture.componentInstance.generate();

    expect(storeStub.generate).toHaveBeenCalledWith(10, {
      storyText: 'Como usuario quiero exportar datos',
    });
  });

  it('keeps the typed story text and edited drafts when generate fails', async () => {
    build();
    fixture.detectChanges();

    storeStub.generated.set([{ title: 'Editada', description: 'x' }]);
    fixture.detectChanges();
    fixture.detectChanges();

    fixture.componentInstance.storyText.set('texto en progreso');
    storeStub.generate.mockResolvedValueOnce(false);
    await fixture.componentInstance.generate();
    fixture.detectChanges();

    expect(fixture.componentInstance.storyText()).toBe('texto en progreso');
    expect(fixture.componentInstance.drafts()).toEqual([{ title: 'Editada', description: 'x' }]);
  });

  function seedDrafts(drafts: SubtaskDraft[]): void {
    storeStub.generated.set(drafts);
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('populates the column select from the board columns and requires a choice to confirm', () => {
    build();
    fixture.detectChanges();
    seedDrafts([{ title: 'A', description: '' }]);

    const options = [
      ...fixture.nativeElement.querySelectorAll('[data-testid="subtasks-column-select"] option'),
    ].map((o) => (o as HTMLOptionElement).textContent?.trim());
    expect(options).toEqual(['Selecciona una columna…', 'Backlog', 'En curso']);

    const confirm = q('subtasks-confirm') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fixture.componentInstance.selectColumn('2');
    fixture.detectChanges();
    expect((q('subtasks-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('lists only PLANNED and ACTIVE sprints plus a "Sin sprint" option, excluding COMPLETED', () => {
    build(
      [workItem()],
      DEFAULT_COLUMNS,
      [
        sprint(1, 'Sprint 1', 'PLANNED'),
        sprint(2, 'Sprint 2', 'ACTIVE'),
        sprint(3, 'Sprint 3', 'COMPLETED'),
      ],
    );
    fixture.detectChanges();
    seedDrafts([{ title: 'A', description: '' }]);

    const options = [
      ...fixture.nativeElement.querySelectorAll('[data-testid="subtasks-sprint-select"] option'),
    ].map((o) => (o as HTMLOptionElement).textContent?.trim());
    expect(options).toEqual(['Sin sprint', 'Sprint 1', 'Sprint 2']);
  });

  it('confirms the batch with the parent link, column, sprint and provenance, then navigates to the board', async () => {
    build([workItem({ id: 55, childCount: 0 })], DEFAULT_COLUMNS, [sprint(8, 'Sprint 8', 'ACTIVE')]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();
    seedDrafts([
      { title: 'A', description: 'da' },
      { title: 'B', description: '' },
    ]);

    storeStub.model.set('llama3');
    storeStub.confirm.mockResolvedValueOnce(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.selectColumn('2');
    fixture.componentInstance.selectSprint('8');
    await fixture.componentInstance.confirm();

    expect(storeStub.confirm).toHaveBeenCalledWith(10, {
      columnId: 2,
      parentWorkItemId: 55,
      sprintId: 8,
      aiGenerated: true,
      aiModel: 'llama3',
      subtasks: [
        { title: 'A', description: 'da' },
        { title: 'B', description: '' },
      ],
    });
    expect(navigate).toHaveBeenCalledWith(['/projects', 10, 'board']);
    expect(fixture.componentInstance.drafts()).toEqual([]);
  });

  it('omits parentWorkItemId in free-text mode (b)', async () => {
    build();
    fixture.detectChanges();
    seedDrafts([{ title: 'A', description: '' }]);

    storeStub.confirm.mockResolvedValueOnce(true);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.selectColumn('1');
    await fixture.componentInstance.confirm();

    expect(storeStub.confirm).toHaveBeenCalledWith(10, {
      columnId: 1,
      aiGenerated: true,
      aiModel: null,
      subtasks: [{ title: 'A', description: '' }],
    });
  });

  it('keeps the drafts and the column selection when the batch confirm fails', async () => {
    build([workItem({ id: 55, childCount: 0 })]);
    fixture.componentRef.setInput('workItemId', '55');
    fixture.detectChanges();
    seedDrafts([{ title: 'A', description: 'da' }]);

    storeStub.confirm.mockResolvedValueOnce(false);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fixture.componentInstance.selectColumn('2');
    await fixture.componentInstance.confirm();

    expect(fixture.componentInstance.drafts()).toEqual([{ title: 'A', description: 'da' }]);
    expect(fixture.componentInstance.columnId()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the store error message', () => {
    build();
    fixture.detectChanges();

    storeStub.error.set('El asistente de IA no está disponible en este momento.');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'El asistente de IA no está disponible en este momento.',
    );
  });
});
