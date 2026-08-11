import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BoardApiService } from './board-api.service';
import { BoardColumn, WorkItem } from './board.model';
import { BoardStore } from './board.store';

function column(id: number, name: string, position: number): BoardColumn {
  return { id, name, position };
}

function item(id: number, columnId: number, position: number, title = `Item ${id}`): WorkItem {
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

describe('BoardStore', () => {
  let apiSpy: {
    getBoardColumns: ReturnType<typeof vi.fn>;
    getWorkItems: ReturnType<typeof vi.fn>;
    moveWorkItem: ReturnType<typeof vi.fn>;
  };
  let store: BoardStore;

  beforeEach(() => {
    apiSpy = {
      getBoardColumns: vi.fn(),
      getWorkItems: vi.fn(),
      moveWorkItem: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [BoardStore, { provide: BoardApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(BoardStore);
  });

  it('groups loaded work items by column, ordered by position', () => {
    apiSpy.getBoardColumns.mockReturnValue(
      of([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]),
    );
    apiSpy.getWorkItems.mockReturnValue(
      of([item(500, 1, 2048, 'Second'), item(501, 1, 1024, 'First'), item(502, 2, 1024, 'Only')]),
    );

    store.load(10);

    expect(store.columns()).toHaveLength(2);
    expect(store.itemsByColumn()[1]?.map((i) => i.title)).toEqual(['First', 'Second']);
    expect(store.itemsByColumn()[2]?.map((i) => i.title)).toEqual(['Only']);
  });

  it('optimistically moves an item to a new column before the server responds', () => {
    apiSpy.getBoardColumns.mockReturnValue(of([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]));
    apiSpy.getWorkItems.mockReturnValue(of([item(500, 1, 1024, 'Task')]));
    apiSpy.moveWorkItem.mockReturnValue(
      of(item(500, 2, 1024, 'Task')),
    );
    store.load(10);

    store.moveItem(500, 2, 0);

    expect(store.itemsByColumn()[2]?.map((i) => i.id)).toEqual([500]);
    expect(store.itemsByColumn()[1] ?? []).toEqual([]);
    expect(apiSpy.moveWorkItem).toHaveBeenCalledWith(500, { columnId: 2, position: 0 });
  });

  it('rolls back the optimistic move when the server rejects it', () => {
    apiSpy.getBoardColumns.mockReturnValue(of([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]));
    apiSpy.getWorkItems.mockReturnValue(of([item(500, 1, 1024, 'Task')]));
    apiSpy.moveWorkItem.mockReturnValue(throwError(() => new Error('cross-project column')));
    store.load(10);

    store.moveItem(500, 2, 0);

    expect(store.itemsByColumn()[1]?.map((i) => i.id)).toEqual([500]);
    expect(store.itemsByColumn()[2] ?? []).toEqual([]);
    expect(store.error()).toBe('cross-project column');
  });
});
