import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

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
    assignedUserName: null,
    position,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('BoardStore', () => {
  let apiSpy: {
    getBoardColumns: ReturnType<typeof vi.fn>;
    getWorkItems: ReturnType<typeof vi.fn>;
    createWorkItem: ReturnType<typeof vi.fn>;
    getWorkItem: ReturnType<typeof vi.fn>;
    updateWorkItem: ReturnType<typeof vi.fn>;
    deleteWorkItem: ReturnType<typeof vi.fn>;
    moveWorkItem: ReturnType<typeof vi.fn>;
  };
  let store: BoardStore;

  beforeEach(() => {
    apiSpy = {
      getBoardColumns: vi.fn(),
      getWorkItems: vi.fn(),
      createWorkItem: vi.fn(),
      getWorkItem: vi.fn(),
      updateWorkItem: vi.fn(),
      deleteWorkItem: vi.fn(),
      moveWorkItem: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [BoardStore, { provide: BoardApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(BoardStore);
  });

  function loadWith(items: WorkItem[] = [item(500, 1, 1024, 'Task')]): void {
    apiSpy.getBoardColumns.mockReturnValue(of([column(1, 'Por hacer', 1024), column(2, 'En progreso', 2048)]));
    apiSpy.getWorkItems.mockReturnValue(of(items));
    store.load(10);
  }

  it('groups loaded work items by column, ordered by position', () => {
    loadWith([item(500, 1, 2048, 'Second'), item(501, 1, 1024, 'First'), item(502, 2, 1024, 'Only')]);

    expect(store.columns()).toHaveLength(2);
    expect(store.itemsByColumn()[1]?.map((i) => i.title)).toEqual(['First', 'Second']);
    expect(store.itemsByColumn()[2]?.map((i) => i.title)).toEqual(['Only']);
  });

  it('clears board state and surfaces an error when the board load fails', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    apiSpy.getBoardColumns.mockReturnValue(throwError(() => ({ error: { detail: 'sin acceso' } })));
    apiSpy.getWorkItems.mockReturnValue(of([item(501, 1, 2048, 'Stale')]));

    store.load(10);

    expect(store.columns()).toEqual([]);
    expect(store.itemsByColumn()).toEqual({});
    expect(store.error()).toBe('sin acceso');
  });

  it('uses a generic message when the board load error has no detail', () => {
    apiSpy.getBoardColumns.mockReturnValue(of([column(1, 'Por hacer', 1024)]));
    apiSpy.getWorkItems.mockReturnValue(throwError(() => ({})));

    store.load(10);

    expect(store.columns()).toEqual([]);
    expect(store.itemsByColumn()).toEqual({});
    expect(store.error()).toBe('No se pudo cargar el tablero');
  });

  it('ignores stale board load success after a newer load completes', () => {
    const staleColumns = new Subject<BoardColumn[]>();
    const staleItems = new Subject<WorkItem[]>();
    apiSpy.getBoardColumns.mockReturnValueOnce(staleColumns.asObservable());
    apiSpy.getWorkItems.mockReturnValueOnce(staleItems.asObservable());
    apiSpy.getBoardColumns.mockReturnValueOnce(of([column(20, 'Nuevo', 1024)]));
    apiSpy.getWorkItems.mockReturnValueOnce(of([item(700, 20, 1024, 'Nueva')]));

    store.load(10);
    store.load(20);
    staleColumns.next([column(10, 'Anterior', 1024)]);
    staleColumns.complete();
    staleItems.next([item(600, 10, 1024, 'Anterior')]);
    staleItems.complete();

    expect(store.columns()).toEqual([column(20, 'Nuevo', 1024)]);
    expect(store.itemsByColumn()[20]?.map((i) => i.title)).toEqual(['Nueva']);
    expect(store.itemsByColumn()[10] ?? []).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('ignores stale board load errors after a newer load completes', () => {
    const staleColumns = new Subject<BoardColumn[]>();
    apiSpy.getBoardColumns.mockReturnValueOnce(staleColumns.asObservable());
    apiSpy.getWorkItems.mockReturnValueOnce(of([item(600, 10, 1024, 'Anterior')]));
    apiSpy.getBoardColumns.mockReturnValueOnce(of([column(20, 'Nuevo', 1024)]));
    apiSpy.getWorkItems.mockReturnValueOnce(of([item(700, 20, 1024, 'Nueva')]));

    store.load(10);
    store.load(20);
    staleColumns.error({ error: { detail: 'carga anterior falló' } });

    expect(store.columns()).toEqual([column(20, 'Nuevo', 1024)]);
    expect(store.itemsByColumn()[20]?.map((i) => i.title)).toEqual(['Nueva']);
    expect(store.itemsByColumn()[10] ?? []).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('creates an item, appends it to the board, and selects it', () => {
    loadWith([]);
    const created = item(600, 1, 1024, 'Nueva tarea');
    apiSpy.createWorkItem.mockReturnValue(of(created));

    store.createItem(10, { title: 'Nueva tarea', description: null, assignedUserId: null });

    expect(apiSpy.createWorkItem).toHaveBeenCalledWith(10, {
      title: 'Nueva tarea',
      description: null,
      assignedUserId: null,
    });
    expect(store.itemsByColumn()[1]?.map((i) => i.id)).toEqual([600]);
    expect(store.selectedItem()?.id).toBe(600);
    expect(store.isMutating()).toBe(false);
    expect(store.success()).toBe('Tarea creada correctamente.');
  });

  it('clears creation feedback when a later mutation starts or fails', () => {
    loadWith([]);
    apiSpy.createWorkItem.mockReturnValueOnce(of(item(600, 1, 1024, 'Nueva tarea'))).mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'sin permiso' } })),
    );

    store.createItem(10, { title: 'Nueva tarea' });
    expect(store.success()).toBe('Tarea creada correctamente.');

    store.createItem(10, { title: 'Otra tarea' });

    expect(store.success()).toBeNull();
    expect(store.error()).toBe('sin permiso');
  });

  it('loads detail for a selected item and upserts the response', () => {
    loadWith([item(500, 1, 1024, 'Draft')]);
    const detailed = { ...item(500, 1, 1024, 'Draft'), description: 'Detalle' };
    apiSpy.getWorkItem.mockReturnValue(of(detailed));

    store.loadItem(500);

    expect(apiSpy.getWorkItem).toHaveBeenCalledWith(500);
    expect(store.selectedItem()).toEqual(detailed);
    expect(store.itemsByColumn()[1]?.[0].description).toBe('Detalle');
  });

  it('ignores a stale detail response after selecting another item', () => {
    loadWith([item(500, 1, 1024, 'First'), item(501, 1, 2048, 'Second')]);
    const firstResponse = new Subject<WorkItem>();
    const secondResponse = new Subject<WorkItem>();
    apiSpy.getWorkItem.mockReturnValueOnce(firstResponse.asObservable()).mockReturnValueOnce(secondResponse.asObservable());

    store.selectItem(item(500, 1, 1024, 'First'));
    store.loadItem(500);
    store.selectItem(item(501, 1, 2048, 'Second'));
    store.loadItem(501);

    firstResponse.next({ ...item(500, 1, 1024, 'First'), description: 'Stale detail' });

    expect(store.selectedItem()?.id).toBe(501);
    expect(store.itemsByColumn()[1]?.find((current) => current.id === 500)?.description).toBeNull();
  });

  it('ignores a stale detail response after the item is deleted', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    const detailResponse = new Subject<WorkItem>();
    apiSpy.getWorkItem.mockReturnValue(detailResponse.asObservable());
    apiSpy.deleteWorkItem.mockReturnValue(of(undefined));

    store.selectItem(item(500, 1, 1024, 'Task'));
    store.loadItem(500);
    store.deleteItem(500);
    detailResponse.next({ ...item(500, 1, 1024, 'Task'), description: 'Resurrected' });

    expect(store.selectedItem()).toBeNull();
    expect(store.itemsByColumn()[1] ?? []).toEqual([]);
  });

  it('updates an item and keeps detail selection in sync', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    store.selectItem(item(500, 1, 1024, 'Task'));
    const updated = { ...item(500, 1, 1024, 'Task editada'), assignedUserId: 42 };
    apiSpy.updateWorkItem.mockReturnValue(of(updated));

    store.updateItem(500, { title: 'Task editada', description: null, assignedUserId: 42 });

    expect(apiSpy.updateWorkItem).toHaveBeenCalledWith(500, {
      title: 'Task editada',
      description: null,
      assignedUserId: 42,
    });
    expect(store.itemsByColumn()[1]?.[0].title).toBe('Task editada');
    expect(store.selectedItem()?.assignedUserId).toBe(42);
  });

  it('deletes an item and clears detail selection', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    store.selectItem(item(500, 1, 1024, 'Task'));
    apiSpy.deleteWorkItem.mockReturnValue(of(undefined));

    store.deleteItem(500);

    expect(apiSpy.deleteWorkItem).toHaveBeenCalledWith(500);
    expect(store.itemsByColumn()[1] ?? []).toEqual([]);
    expect(store.selectedItem()).toBeNull();
  });

  it('surfaces a mutation error and clears the busy flag', () => {
    loadWith([]);
    apiSpy.createWorkItem.mockReturnValue(throwError(() => ({ error: { detail: 'sin permiso' } })));

    store.createItem(10, { title: 'Nueva tarea' });

    expect(store.error()).toBe('sin permiso');
    expect(store.isMutating()).toBe(false);
  });

  it('optimistically moves an item to a new column before the server responds', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    apiSpy.moveWorkItem.mockReturnValue(of(item(500, 2, 1024, 'Task')));

    store.moveItem(500, 2, 0);

    expect(store.itemsByColumn()[2]?.map((i) => i.id)).toEqual([500]);
    expect(store.itemsByColumn()[1] ?? []).toEqual([]);
    expect(apiSpy.moveWorkItem).toHaveBeenCalledWith(500, { columnId: 2, position: 0 });
  });

  it('keeps optimistic render order when moving into a non-empty target column', () => {
    const serverMove = new Subject<WorkItem>();
    loadWith([item(500, 1, 1024, 'Moved'), item(501, 2, 1024, 'First'), item(502, 2, 2048, 'Second')]);
    apiSpy.moveWorkItem.mockReturnValue(serverMove.asObservable());

    store.moveItem(500, 2, 1);

    expect(store.itemsByColumn()[2]?.map((i) => i.id)).toEqual([501, 500, 502]);
    expect(apiSpy.moveWorkItem).toHaveBeenCalledWith(500, { columnId: 2, position: 1 });
  });

  it('keeps optimistic render order when reordering within a non-empty column', () => {
    const serverMove = new Subject<WorkItem>();
    loadWith([item(500, 1, 1024, 'First'), item(501, 1, 2048, 'Second'), item(502, 1, 3072, 'Third')]);
    apiSpy.moveWorkItem.mockReturnValue(serverMove.asObservable());

    store.moveItem(502, 1, 0);

    expect(store.itemsByColumn()[1]?.map((i) => i.id)).toEqual([502, 500, 501]);
    expect(apiSpy.moveWorkItem).toHaveBeenCalledWith(502, { columnId: 1, position: 0 });
  });

  it('rolls back the optimistic move when the server rejects it', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    apiSpy.moveWorkItem.mockReturnValue(throwError(() => ({ error: { detail: 'cross-project column' } })));

    store.moveItem(500, 2, 0);

    expect(store.itemsByColumn()[1]?.map((i) => i.id)).toEqual([500]);
    expect(store.itemsByColumn()[2] ?? []).toEqual([]);
    expect(store.error()).toBe('cross-project column');
  });

  it('applies resequenced sibling positions from the move response affectedItems', () => {
    loadWith([item(500, 1, 1024, 'Moved'), item(501, 2, 1024, 'First'), item(502, 2, 1025, 'Second')]);
    const moved = item(500, 2, 2048, 'Moved');
    moved.affectedItems = [item(501, 2, 1024, 'First'), item(502, 2, 3072, 'Second')];
    apiSpy.moveWorkItem.mockReturnValue(of(moved));

    store.moveItem(500, 2, 1);

    expect(store.itemsByColumn()[2]?.find((i) => i.id === 502)?.position).toBe(3072);
    expect(store.itemsByColumn()[2]?.find((i) => i.id === 501)?.position).toBe(1024);
    expect(store.itemsByColumn()[2]?.find((i) => i.id === 500)?.position).toBe(2048);
  });

  it('does not touch siblings when the move response has no affectedItems', () => {
    loadWith([item(500, 1, 1024, 'Moved'), item(501, 2, 1024, 'First')]);
    apiSpy.moveWorkItem.mockReturnValue(of(item(500, 2, 2048, 'Moved')));

    store.moveItem(500, 2, 1);

    expect(store.itemsByColumn()[2]?.find((i) => i.id === 501)?.position).toBe(1024);
  });

  it('falls back to a generic message when the server error has no detail', () => {
    loadWith([item(500, 1, 1024, 'Task')]);
    apiSpy.moveWorkItem.mockReturnValue(throwError(() => ({})));

    store.moveItem(500, 2, 0);

    expect(store.error()).toBe('No se pudo mover la tarea');
  });

  it('retains hierarchy fields on loaded items', () => {
    loadWith([
      { ...item(500, 1, 1024, 'Child'), parentWorkItemId: 900, parentWorkItemTitle: 'Historia', childCount: 0 },
    ]);

    const loaded = store.itemsByColumn()[1]?.[0];
    expect(loaded?.parentWorkItemId).toBe(900);
    expect(loaded?.parentWorkItemTitle).toBe('Historia');
    expect(loaded?.childCount).toBe(0);
  });

  it('keeps hierarchy fields after a move round-trip', () => {
    loadWith([
      { ...item(500, 1, 1024, 'Child'), parentWorkItemId: 900, parentWorkItemTitle: 'Historia', childCount: 2 },
    ]);
    apiSpy.moveWorkItem.mockReturnValue(
      of({ ...item(500, 2, 1024, 'Child'), parentWorkItemId: 900, parentWorkItemTitle: 'Historia', childCount: 2 }),
    );

    store.moveItem(500, 2, 0);

    const moved = store.itemsByColumn()[2]?.[0];
    expect(moved?.parentWorkItemTitle).toBe('Historia');
    expect(moved?.childCount).toBe(2);
  });

  describe('eligibleParents', () => {
    it('excludes self, items that already have a parent, and items that already have children', () => {
      loadWith([
        item(500, 1, 1024, 'Target'),
        { ...item(501, 1, 2048, 'Already a child'), parentWorkItemId: 999 },
        { ...item(502, 1, 3072, 'Already a parent'), childCount: 3 },
        item(503, 1, 4096, 'Free story'),
      ]);
      store.selectItem(item(500, 1, 1024, 'Target'));

      expect(store.eligibleParents().map((i) => i.id)).toEqual([503]);
    });

    it('is empty when no item is selected', () => {
      loadWith([item(503, 1, 1024, 'Free')]);

      expect(store.eligibleParents()).toEqual([]);
    });

    it("always keeps the selected item's current parent selectable even though it has children", () => {
      const currentParent = { ...item(900, 1, 512, 'Historia madre'), childCount: 2 };
      loadWith([
        { ...item(500, 1, 1024, 'Subtarea'), parentWorkItemId: 900 },
        currentParent,
        item(503, 1, 4096, 'Free story'),
      ]);
      store.selectItem({ ...item(500, 1, 1024, 'Subtarea'), parentWorkItemId: 900 });

      const ids = store.eligibleParents().map((i) => i.id);
      expect(ids).toContain(900);
      expect(ids).toContain(503);
    });
  });
});
