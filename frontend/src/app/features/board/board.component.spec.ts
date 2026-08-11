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
    error: ReturnType<typeof signal<string | null>>;
    load: ReturnType<typeof vi.fn>;
    moveItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      columns: signal([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]),
      itemsByColumn: signal({
        1: [item(500, 1, 1024, 'Design schema')],
        2: [],
      }),
      error: signal(null),
      load: vi.fn(),
      moveItem: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [provideRouter([]), { provide: BoardStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardComponent);
    fixture.componentRef.setInput('projectId', 10);
    fixture.detectChanges();
  });

  it('loads the board for the given project on init', () => {
    expect(storeStub.load).toHaveBeenCalledWith(10);
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

  it('displays the store error when a move is rejected', () => {
    storeStub.error.set('cross-project column');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="board-error"]')?.textContent).toContain(
      'cross-project column',
    );
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

  it('links back to the projects list', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('[data-testid="board-projects-link"]');
    expect(link?.getAttribute('href')).toBe('/projects');
  });
});
