import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BoardComponent } from './board.component';
import { BoardStore } from './board.store';
import { BoardColumn, WorkItem } from './board.model';

function column(id: number, name: string, position: number): BoardColumn {
  return { id, name, position };
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

  beforeEach(async () => {
    storeStub = {
      columns: signal([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]),
      itemsByColumn: signal({
        1: [item(500, 1, 1024, 'Design schema')],
        2: [],
      }),
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

    await TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [provideRouter([]), { provide: BoardStore, useValue: storeStub }],
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

  it('moves the open task to another column via the detail panel select', () => {
    storeStub.selectedItem.set(item(500, 1, 1024, 'Design schema'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const select = compiled.querySelector('[data-testid="move-to-column-select"]') as HTMLSelectElement;
    expect(select.value).toBe('1');

    select.value = '2';
    select.dispatchEvent(new Event('change'));

    expect(storeStub.moveItem).toHaveBeenCalledWith(500, 2, 1024);
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
