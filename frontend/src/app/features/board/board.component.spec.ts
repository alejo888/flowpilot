import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AiConfigService } from '../../core/ai/ai-config.service';
import { BoardComponent } from './board.component';
import { BoardStore } from './board.store';
import { BoardColumn, WorkItem } from './board.model';
import { CommentsStore } from '../comments/comments.store';
import { Project } from '../projects/project.model';
import { ProjectsStore } from '../projects/projects.store';

function column(id: number, name: string, position: number): BoardColumn {
  return { id, name, position };
}

function project(
  callerPermissions: Project['callerPermissions'] = [
    'WORKITEM_CREATE',
    'WORKITEM_EDIT',
    'WORKITEM_DELETE',
    'WORKITEM_MOVE',
    'COMMENT_CREATE',
  ],
): Project {
  return {
    id: 10,
    name: 'Proyecto',
    description: null,
    status: 'PLANIFICACION',
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    code: null,
    startDate: null,
    estimatedEndDate: null,
    technologies: null,
    repositoryUrl: null,
    callerPermissions,
  };
}

function item(id: number, columnId: number, position: number, title: string): WorkItem {
  return {
    id,
    projectId: 10,
    columnId,
    title,
    description: null,
    assignedUserId: null,
    assignedUserName: null,
    position,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('BoardComponent', () => {
  let fixture: ComponentFixture<BoardComponent>;
  let storeStub: {
    columns: ReturnType<typeof signal<BoardColumn[]>>;
    itemsByColumn: ReturnType<typeof signal<Record<number, WorkItem[]>>>;
    eligibleParents: ReturnType<typeof signal<WorkItem[]>>;
    selectedItem: ReturnType<typeof signal<WorkItem | null>>;
    error: ReturnType<typeof signal<string | null>>;
    success: ReturnType<typeof signal<string | null>>;
    isMutating: ReturnType<typeof signal<boolean>>;
    load: ReturnType<typeof vi.fn>;
    createItem: ReturnType<typeof vi.fn>;
    clearSuccess: ReturnType<typeof vi.fn>;
    selectItem: ReturnType<typeof vi.fn>;
    loadItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
    moveItem: ReturnType<typeof vi.fn>;
  };
  let projectsStoreStub: { selectedProject: ReturnType<typeof signal<Project | null>>; loadProject: ReturnType<typeof vi.fn> };
  let aiConfigStub: { aiEnabled: ReturnType<typeof signal<boolean>>; load: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    aiConfigStub = { aiEnabled: signal(false), load: vi.fn() };
    storeStub = {
      columns: signal([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]),
      itemsByColumn: signal({
        1: [item(500, 1, 1024, 'Design schema')],
        2: [],
      }),
      eligibleParents: signal<WorkItem[]>([]),
      selectedItem: signal(null),
      error: signal(null),
      success: signal(null),
      isMutating: signal(false),
      load: vi.fn(),
      createItem: vi.fn(),
      clearSuccess: vi.fn(),
      selectItem: vi.fn((selected: WorkItem | null) => storeStub.selectedItem.set(selected)),
      loadItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      moveItem: vi.fn(),
    };
    projectsStoreStub = { selectedProject: signal(project()), loadProject: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [
        provideRouter([]),
        { provide: BoardStore, useValue: storeStub },
        { provide: ProjectsStore, useValue: projectsStoreStub },
        { provide: AiConfigService, useValue: aiConfigStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardComponent);
    fixture.componentRef.setInput('projectId', '10');
    fixture.detectChanges();
  });

  it('loads the board for the given project input without duplicate initial loads', () => {
    expect(storeStub.load).toHaveBeenCalledTimes(1);
    expect(storeStub.load).toHaveBeenCalledWith(10);
  });

  it('reloads the board when the project input changes', () => {
    fixture.componentRef.setInput('projectId', 20);
    fixture.detectChanges();

    expect(storeStub.load).toHaveBeenCalledTimes(2);
    expect(storeStub.load).toHaveBeenLastCalledWith(20);
  });

  it('renders each column with its name and its work items', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const columnHeadings = Array.from(compiled.querySelectorAll('[data-testid="column-name"]')).map(
      (el) => el.textContent?.trim(),
    );
    expect(columnHeadings).toEqual(['Por hacer', 'En progreso']);

    const cards = Array.from(compiled.querySelectorAll('[data-testid="work-item-title"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(cards).toEqual(['Design schema']);
  });

  it('shows the detail panel as an overlay only when an item is selected', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="detail-panel"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="detail-backdrop"]')).toBeNull();

    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="detail-panel"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="detail-backdrop"]')).not.toBeNull();
  });

  it('closes the detail panel when the backdrop is clicked', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('[data-testid="detail-backdrop"]') as HTMLElement).click();

    expect(storeStub.selectItem).toHaveBeenCalledWith(null);
  });

  it('hides the "Generar subtareas" action while the AI assistant is disabled', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="generate-subtasks"]')).toBeNull();
  });

  it('shows the "Generar subtareas" action linking to the AI route with the item id when AI is enabled and the caller can create work items', () => {
    aiConfigStub.aiEnabled.set(true);
    projectsStoreStub.selectedProject.set(project(['WORKITEM_CREATE']));
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="generate-subtasks"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/projects/10/ai/subtasks?workItemId=500');
  });

  it('hides the "Generar subtareas" action when the caller lacks WORKITEM_CREATE', () => {
    aiConfigStub.aiEnabled.set(true);
    projectsStoreStub.selectedProject.set(project(['WORKITEM_EDIT']));
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="generate-subtasks"]')).toBeNull();
  });

  it('hides the "Generar subtareas" action when the selected item is itself a subtask', () => {
    aiConfigStub.aiEnabled.set(true);
    projectsStoreStub.selectedProject.set(project(['WORKITEM_CREATE']));
    storeStub.selectedItem.set({ ...item(501, 1, 1024, 'Subtarea'), parentWorkItemId: 500 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="generate-subtasks"]')).toBeNull();
  });

  it('renders successful task creation feedback', () => {
    storeStub.success.set('Tarea creada correctamente.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="board-success"]')?.textContent).toContain(
      'Tarea creada correctamente.',
    );
  });

  it('opens the create panel and submits a normalized create request', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    findButton(compiled, 'Crear tarea').click();
    fixture.detectChanges();

    expect(compiled.querySelector('[data-testid="create-form"]')).not.toBeNull();

    fixture.componentInstance.createForm = {
      title: '  Nueva tarea  ',
      description: '  Detalle  ',
      assignedUserId: 42,
    };
    fixture.componentInstance.submitCreate();

    expect(storeStub.createItem).toHaveBeenCalledWith(10, {
      title: 'Nueva tarea',
      description: 'Detalle',
      assignedUserId: 42,
    });
    expect(fixture.componentInstance.showCreateForm()).toBe(false);
  });

  it('opens task detail on card title click and loads fresh detail', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    (compiled.querySelector('[data-testid="work-item-title"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(storeStub.selectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 500 }));
    expect(storeStub.loadItem).toHaveBeenCalledWith(500);
    expect(compiled.querySelector('[data-testid="detail-panel"]')?.textContent).toContain('Design schema');
  });

  it('submits task edits from the detail panel', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Design schema'), description: 'Old' });
    fixture.detectChanges();

    fixture.componentInstance.editForm = {
      title: '  Schema editado ',
      description: '',
      assignedUserId: null,
    };
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(500, {
      title: 'Schema editado',
      description: null,
      assignedUserId: null,
    });
  });

  it('keeps the item sprint assignment when editing from the detail panel', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Design schema'), sprintId: 7 });
    fixture.detectChanges();

    fixture.componentInstance.editForm.title = 'Schema editado';
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(500, {
      title: 'Schema editado',
      description: null,
      assignedUserId: null,
      sprintId: 7,
      priority: null,
      parentWorkItemId: null,
      acceptanceCriteria: [],
    });
  });

  it('keeps the item priority when editing from the detail panel', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Design schema'), priority: 'HIGH' });
    fixture.detectChanges();

    fixture.componentInstance.editForm.title = 'Schema editado';
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(500, {
      title: 'Schema editado',
      description: null,
      assignedUserId: null,
      sprintId: null,
      priority: 'HIGH',
      parentWorkItemId: null,
      acceptanceCriteria: [],
    });
  });

  it('keeps acceptanceCriteria when saving a detail-panel edit', () => {
    storeStub.selectedItem.set({
      ...item(500, 1, 1024, 'Design schema'),
      acceptanceCriteria: ['Dado A', 'Cuando B', 'Entonces C'],
    });
    fixture.detectChanges();

    fixture.componentInstance.editForm.title = 'Schema editado';
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(
      500,
      expect.objectContaining({ acceptanceCriteria: ['Dado A', 'Cuando B', 'Entonces C'] }),
    );
  });

  it('renders the acceptance-criteria editor in the detail panel bound to the item criteria', () => {
    storeStub.selectedItem.set({
      ...item(500, 1, 1024, 'Design schema'),
      acceptanceCriteria: ['Dado A', 'Cuando B'],
    });
    fixture.detectChanges();

    const editor = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="acceptance-criteria-editor"]',
    );
    expect(editor).not.toBeNull();
    const values = Array.from(editor!.querySelectorAll('[data-testid="criteria-input"]')).map(
      (el) => (el as HTMLInputElement).value,
    );
    expect(values).toEqual(['Dado A', 'Cuando B']);
  });

  it('persists an added criterion through the work-item PUT after editing it in the panel', () => {
    storeStub.selectedItem.set({
      ...item(500, 1, 1024, 'Design schema'),
      acceptanceCriteria: ['Dado A'],
    });
    fixture.detectChanges();

    const editor = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="acceptance-criteria-editor"]',
    ) as HTMLElement;
    (editor.querySelector('[data-testid="criteria-add"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const inputs = Array.from(
      editor.querySelectorAll('[data-testid="criteria-input"]'),
    ) as HTMLInputElement[];
    inputs[1].value = 'Cuando B';
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(
      500,
      expect.objectContaining({ acceptanceCriteria: ['Dado A', 'Cuando B'] }),
    );
  });

  it('renders the criteria editor read-only when the caller lacks WORKITEM_EDIT', () => {
    projectsStoreStub.selectedProject.set(project(['WORKITEM_MOVE']));
    storeStub.selectedItem.set({
      ...item(500, 1, 1024, 'Design schema'),
      acceptanceCriteria: ['Dado A'],
    });
    fixture.detectChanges();

    const editor = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="acceptance-criteria-editor"]',
    ) as HTMLElement;
    expect(editor).not.toBeNull();
    const input = editor.querySelector('[data-testid="criteria-input"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect((editor.querySelector('[data-testid="criteria-add"]') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('opens an accessible delete confirmation dialog', () => {
    fixture.componentInstance.confirmDelete(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[data-testid="delete-dialog"]') as HTMLElement;
    const panel = dialog.querySelector('.fp-dialog__panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('delete-dialog-title');
    expect(panel.getAttribute('aria-describedby')).toBe('delete-dialog-description');
    expect(dialog.querySelector('#delete-dialog-title')?.textContent).toContain('Eliminar tarea');
    expect(dialog.querySelector('#delete-dialog-description')?.textContent).toBe(
      '¿Seguro que querés eliminar la tarea \"Design schema\"? Esta acción no se puede deshacer.',
    );
  });

  it('deletes only after confirmation and closes the dialog', () => {
    fixture.componentInstance.confirmDelete(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Sí, eliminar').click();
    fixture.detectChanges();
    expect(storeStub.deleteItem).toHaveBeenCalledWith(500);
    expect(fixture.nativeElement.querySelector('[data-testid="delete-dialog"]')).toBeNull();
  });

  it('cancels deletion without calling the store', () => {
    fixture.componentInstance.confirmDelete(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();
    findButton(fixture.nativeElement, 'Cancelar').click();
    fixture.detectChanges();
    expect(storeStub.deleteItem).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="delete-dialog"]')).toBeNull();
  });

  it('closes the delete confirmation dialog on Escape without calling the store', () => {
    fixture.componentInstance.confirmDelete(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="delete-dialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(storeStub.deleteItem).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="delete-dialog"]')).toBeNull();
  });

  it('displays the store error when a move is rejected', () => {
    storeStub.error.set('cross-project column');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="board-error"]')?.textContent).toContain('cross-project column');
  });

  it('renders one tab per column with the first column active by default', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(compiled.querySelectorAll('[data-testid="column-tab"]'));

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Por hacer', 'En progreso']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('switches the active column tab on click', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(compiled.querySelectorAll('[data-testid="column-tab"]')) as HTMLButtonElement[];

    tabs[1].click();
    fixture.detectChanges();

    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('marks non-active columns for mobile hiding, keeping desktop layout untouched', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sections = Array.from(compiled.querySelectorAll('.board-column'));

    expect(sections[0].classList.contains('board-column--inactive-mobile')).toBe(false);
    expect(sections[1].classList.contains('board-column--inactive-mobile')).toBe(true);
  });

  it('moves the open task to the end of an empty target column via the detail panel select', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement;
    expect(select.value).toBe('1');

    select.value = '2';
    select.dispatchEvent(new Event('change'));

    // Column 2 starts empty, so the end-of-column insertion index is 0 —
    // NOT the moved item's own gap-based position (1024), which is what the
    // old (buggy) implementation sent.
    expect(storeStub.moveItem).toHaveBeenCalledWith(500, 2, 0);
  });

  it('computes the end-of-column index from the target column item count, not the moved item position', () => {
    storeStub.itemsByColumn.set({
      1: [item(500, 1, 1024, 'Design schema')],
      2: [item(600, 2, 1024, 'Existing A'), item(601, 2, 2048, 'Existing B'), item(602, 2, 3072, 'Existing C')],
    });
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));

    expect(storeStub.moveItem).toHaveBeenCalledWith(500, 2, 3);
  });

  it('labels the detail panel and manual movement control', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[data-testid="detail-panel"]') as HTMLElement;
    const select = fixture.nativeElement.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-labelledby')).toBe('detail-panel-title');
    expect(panel.getAttribute('aria-describedby')).toBe('detail-panel-description');
    expect(select.getAttribute('aria-label')).toBe('Mover tarea a otra columna');
  });

  it('sets a per-column --fp-column-accent custom property from the known palette', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const sections = Array.from(compiled.querySelectorAll('.board-column')) as HTMLElement[];

    expect(sections[0].style.getPropertyValue('--fp-column-accent')).toBe('#9a9186');
    expect(sections[1].style.getPropertyValue('--fp-column-accent')).toBe('#2a6f8c');
  });

  it('calls store.moveItem with the target column and index on drop', () => {
    const dropEvent = {
      previousContainer: { data: 1, id: 'column-1' },
      container: { data: 2, id: 'column-2' },
      currentIndex: 0,
      item: { data: item(500, 1, 1024, 'Design schema') },
    };

    fixture.componentInstance.onDrop(dropEvent as never);

    expect(storeStub.moveItem).toHaveBeenCalledWith(500, 2, 0);
  });

  it('enables create/edit/delete/move controls when the caller holds the matching permissions', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(findButton(compiled, 'Crear tarea').disabled).toBe(false);
    expect(findButton(compiled, 'Guardar cambios').disabled).toBe(false);
    expect((compiled.querySelector('[data-testid="detail-delete-button"]') as HTMLButtonElement).disabled).toBe(false);
    expect((compiled.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement).disabled).toBe(false);
    expect(fixture.componentInstance.canCreateWorkItem()).toBe(true);
  });

  it('disables create/edit/delete/move controls when the caller lacks the matching permissions', () => {
    projectsStoreStub.selectedProject.set(project([]));
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(findButton(compiled, 'Crear tarea').disabled).toBe(true);
    expect(findButton(compiled, 'Guardar cambios').disabled).toBe(true);
    expect((compiled.querySelector('[data-testid="detail-delete-button"]') as HTMLButtonElement).disabled).toBe(true);
    expect((compiled.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement).disabled).toBe(true);
  });

  it('no-ops a drop without calling store.moveItem when the caller lacks WORKITEM_MOVE', () => {
    projectsStoreStub.selectedProject.set(project([]));
    fixture.detectChanges();

    const dropEvent = {
      previousContainer: { data: 1, id: 'column-1' },
      container: { data: 2, id: 'column-2' },
      currentIndex: 0,
      item: { data: item(500, 1, 1024, 'Design schema') },
    };

    fixture.componentInstance.onDrop(dropEvent as never);

    expect(storeStub.moveItem).not.toHaveBeenCalled();
  });

  it('fails closed (disables gated controls) while the parent project has not loaded yet', () => {
    projectsStoreStub.selectedProject.set(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.canCreateWorkItem()).toBe(false);
    expect(fixture.componentInstance.canEditWorkItem()).toBe(false);
    expect(fixture.componentInstance.canDeleteWorkItem()).toBe(false);
    expect(fixture.componentInstance.canMoveWorkItem()).toBe(false);
  });

  it('shows a pluralized child-count badge on cards with children', () => {
    storeStub.itemsByColumn.set({ 1: [{ ...item(500, 1, 1024, 'Parent'), childCount: 3 }], 2: [] });
    fixture.detectChanges();

    const badge = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="child-count-badge"]');
    expect(badge?.textContent?.trim()).toBe('3 subtareas');
  });

  it('uses the singular noun on the child-count badge for a single child', () => {
    storeStub.itemsByColumn.set({ 1: [{ ...item(500, 1, 1024, 'Parent'), childCount: 1 }], 2: [] });
    fixture.detectChanges();

    const badge = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="child-count-badge"]');
    expect(badge?.textContent?.trim()).toBe('1 subtarea');
  });

  it('renders no child-count badge when childCount is 0 or undefined', () => {
    storeStub.itemsByColumn.set({
      1: [{ ...item(500, 1, 1024, 'Zero'), childCount: 0 }, item(501, 1, 2048, 'Undef')],
      2: [],
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="child-count-badge"]')).toBeNull();
  });

  it('shows the parent story hint on a child card', () => {
    storeStub.itemsByColumn.set({
      1: [{ ...item(500, 1, 1024, 'Child'), parentWorkItemTitle: 'Historia grande' }],
      2: [],
    });
    fixture.detectChanges();

    const hint = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.board-card .assignee')).find(
      (el) => el.textContent?.includes('Historia grande'),
    );
    expect(hint).toBeTruthy();
  });

  it('shows the parent title and child count in the detail panel', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Child'), parentWorkItemTitle: 'Historia X', childCount: 4 });
    fixture.detectChanges();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="detail-panel"]') as HTMLElement;
    expect(panel.querySelector('[data-testid="detail-parent"]')?.textContent).toContain('Historia X');
    expect(panel.querySelector('[data-testid="detail-child-count"]')?.textContent).toContain('4 subtareas');
  });

  it('lists only the eligible parents (plus a blank option) in the parent selector', () => {
    storeStub.eligibleParents.set([item(700, 1, 1024, 'Epic A'), item(701, 1, 2048, 'Epic B')]);
    storeStub.selectedItem.set(item(500, 1, 1024, 'Child'));
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="parent-select"]') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Sin tarea padre', 'Epic A', 'Epic B']);
  });

  it('hides the parent selector when the caller lacks WORKITEM_EDIT', () => {
    projectsStoreStub.selectedProject.set(project(['WORKITEM_MOVE']));
    storeStub.selectedItem.set(item(500, 1, 1024, 'Child'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="parent-select"]')).toBeNull();
  });

  it('round-trips the current parentWorkItemId when submitting an edit', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Child'), parentWorkItemId: 900 });
    fixture.detectChanges();

    fixture.componentInstance.editForm.title = 'Child editado';
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(500, expect.objectContaining({ parentWorkItemId: 900 }));
  });

  it('clears the parent link when the blank option is selected', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Child'), parentWorkItemId: 900 });
    fixture.detectChanges();

    fixture.componentInstance.editForm.parentWorkItemId = null;
    fixture.componentInstance.submitUpdate(500);

    expect(storeStub.updateItem).toHaveBeenCalledWith(500, expect.objectContaining({ parentWorkItemId: null }));
  });

  it('disables the delete control and shows a hint when the open item has children', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Parent'), childCount: 2 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect((compiled.querySelector('[data-testid="detail-delete-button"]') as HTMLButtonElement).disabled).toBe(true);
    expect(compiled.querySelector('[data-testid="delete-child-hint"]')?.textContent).toContain('subtarea');
  });

  it('keeps the delete control enabled for a childless item', () => {
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Leaf'), childCount: 0 });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect((compiled.querySelector('[data-testid="detail-delete-button"]') as HTMLButtonElement).disabled).toBe(false);
    expect(compiled.querySelector('[data-testid="delete-child-hint"]')).toBeNull();
  });

  it('disables the parent selector when the open item already has children (one-level cap)', async () => {
    storeStub.eligibleParents.set([item(700, 1, 1024, 'Epic A')]);
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Parent'), childCount: 2 });
    fixture.detectChanges();
    await fixture.whenStable();

    const select = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="parent-select"]') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('keeps the parent selector enabled for an item without children', async () => {
    storeStub.eligibleParents.set([item(700, 1, 1024, 'Epic A')]);
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Leaf'), childCount: 0 });
    fixture.detectChanges();
    await fixture.whenStable();

    const select = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="parent-select"]') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });

  it("renders the subtask's current parent as the selected option", async () => {
    const currentParent = { ...item(900, 1, 512, 'Historia madre'), childCount: 2 };
    storeStub.eligibleParents.set([currentParent, item(701, 1, 2048, 'Epic B')]);
    storeStub.selectedItem.set({ ...item(500, 1, 1024, 'Subtarea'), parentWorkItemId: 900 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="parent-select"]') as HTMLSelectElement;
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(optionLabels).toContain('Historia madre');
    expect(select.selectedOptions[0]?.textContent?.trim()).toBe('Historia madre');
  });

  it('derives the card badge and the detail-panel child count from the same childCount value', () => {
    const parent = { ...item(500, 1, 1024, 'Parent'), childCount: 5 };
    storeStub.itemsByColumn.set({ 1: [parent], 2: [] });
    storeStub.selectedItem.set(parent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badgeText = compiled.querySelector('[data-testid="child-count-badge"]')?.textContent?.trim();
    const panelText = compiled
      .querySelector('[data-testid="detail-panel"]')
      ?.querySelector('[data-testid="detail-child-count"]')
      ?.textContent?.trim();
    expect(badgeText).toBe('5 subtareas');
    expect(panelText).toBe('5 subtareas');
  });
});

describe('BoardComponent work-item comments', () => {
  let fixture: ComponentFixture<BoardComponent>;
  let storeStub: {
    columns: ReturnType<typeof signal<BoardColumn[]>>;
    itemsByColumn: ReturnType<typeof signal<Record<number, WorkItem[]>>>;
    eligibleParents: ReturnType<typeof signal<WorkItem[]>>;
    selectedItem: ReturnType<typeof signal<WorkItem | null>>;
    error: ReturnType<typeof signal<string | null>>;
    success: ReturnType<typeof signal<string | null>>;
    isMutating: ReturnType<typeof signal<boolean>>;
    load: ReturnType<typeof vi.fn>;
    createItem: ReturnType<typeof vi.fn>;
    clearSuccess: ReturnType<typeof vi.fn>;
    selectItem: ReturnType<typeof vi.fn>;
    loadItem: ReturnType<typeof vi.fn>;
    updateItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
    moveItem: ReturnType<typeof vi.fn>;
  };
  let commentsStub: {
    workItemComments: ReturnType<typeof signal<unknown[]>>;
    workItemLoading: ReturnType<typeof signal<boolean>>;
    submitting: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    currentUserId: ReturnType<typeof signal<number | null>>;
    loadWorkItem: ReturnType<typeof vi.fn>;
    createWorkItem: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let projectsStoreStub: { selectedProject: ReturnType<typeof signal<Project | null>>; loadProject: ReturnType<typeof vi.fn> };
  let aiConfigStub: { aiEnabled: ReturnType<typeof signal<boolean>>; load: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    aiConfigStub = { aiEnabled: signal(false), load: vi.fn() };
    storeStub = {
      columns: signal([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]),
      itemsByColumn: signal({ 1: [item(500, 1, 1024, 'Design schema')], 2: [] }),
      eligibleParents: signal<WorkItem[]>([]),
      selectedItem: signal(item(500, 1, 1024, 'Design schema')),
      error: signal(null),
      success: signal(null),
      isMutating: signal(false),
      load: vi.fn(),
      createItem: vi.fn(),
      clearSuccess: vi.fn(),
      selectItem: vi.fn(),
      loadItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      moveItem: vi.fn(),
    };
    commentsStub = {
      workItemComments: signal([]),
      workItemLoading: signal(false),
      submitting: signal(false),
      error: signal<string | null>(null),
      currentUserId: signal<number | null>(4),
      loadWorkItem: vi.fn(),
      createWorkItem: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    projectsStoreStub = { selectedProject: signal(project()), loadProject: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [
        provideRouter([]),
        { provide: BoardStore, useValue: storeStub },
        { provide: CommentsStore, useValue: commentsStub },
        { provide: ProjectsStore, useValue: projectsStoreStub },
        { provide: AiConfigService, useValue: aiConfigStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardComponent);
    fixture.componentRef.setInput('projectId', '10');
    fixture.detectChanges();
  });

  it('keeps the draft when creating a work-item comment fails and clears it on success', async () => {
    commentsStub.createWorkItem.mockResolvedValueOnce(false);
    fixture.componentInstance.commentDraft = '  Texto importante ';

    await fixture.componentInstance.submitWorkComment();

    expect(commentsStub.createWorkItem).toHaveBeenCalledWith(500, 'Texto importante');
    expect(fixture.componentInstance.commentDraft).toBe('  Texto importante ');

    commentsStub.createWorkItem.mockResolvedValueOnce(true);
    await fixture.componentInstance.submitWorkComment();

    expect(fixture.componentInstance.commentDraft).toBe('');
  });

  it('stays in edit mode when saving a work-item comment fails and exits on success', async () => {
    commentsStub.update.mockResolvedValueOnce(false);
    fixture.componentInstance.editingCommentId.set(7);
    fixture.componentInstance.editingContent.set('Corregido');

    await fixture.componentInstance.saveComment(7);

    expect(commentsStub.update).toHaveBeenCalledWith(7, 'Corregido', 'workItem');
    expect(fixture.componentInstance.editingCommentId()).toBe(7);

    commentsStub.update.mockResolvedValueOnce(true);
    await fixture.componentInstance.saveComment(7);

    expect(fixture.componentInstance.editingCommentId()).toBeNull();
  });

  it('keeps the delete confirmation open when deleting a work-item comment fails and closes it on success', async () => {
    commentsStub.delete.mockResolvedValueOnce(false);
    fixture.componentInstance.deletingCommentId.set(7);

    await fixture.componentInstance.deleteCommentConfirmed();

    expect(commentsStub.delete).toHaveBeenCalledWith(7, 'workItem');
    expect(fixture.componentInstance.deletingCommentId()).toBe(7);

    commentsStub.delete.mockResolvedValueOnce(true);
    await fixture.componentInstance.deleteCommentConfirmed();

    expect(fixture.componentInstance.deletingCommentId()).toBeNull();
  });

  it('shows the failure reason inside the still-open comment delete dialog, not behind its backdrop', async () => {
    commentsStub.delete.mockImplementationOnce(async () => {
      commentsStub.error.set('No se pudo eliminar el comentario');
      return false;
    });
    fixture.componentInstance.deletingCommentId.set(7);
    fixture.detectChanges();

    await fixture.componentInstance.deleteCommentConfirmed();
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="comment-delete-dialog"]');
    expect(dialog).not.toBeNull();
    const panel = dialog?.querySelector('.fp-dialog__panel');
    const alert = panel?.querySelector('[data-testid="comment-delete-dialog-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('No se pudo eliminar el comentario');
    // The section-level copy is suppressed while the dialog is open so the
    // same message is not announced twice by two `role="alert"` nodes.
    const sectionAlerts = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.work-comments [role="alert"]'),
    );
    expect(sectionAlerts).toHaveLength(0);
  });
});

function findButton(root: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  return button;
}
