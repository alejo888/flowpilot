import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { WorkItem } from '../board/board.model';
import { BacklogApiService } from './backlog-api.service';
import { BacklogStore } from './backlog.store';
import { Sprint } from './backlog.model';

function item(id: number, sprintId: number | null = null, assignedUserId: number | null = null): WorkItem {
  return {
    id,
    projectId: 10,
    columnId: 1,
    title: `Task ${id}`,
    description: 'Details',
    assignedUserId,
    assignedUserName: assignedUserId === null ? null : 'Ada',
    position: id,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sprintId,
  };
}

function sprint(id: number, status: Sprint['status'] = 'PLANNED'): Sprint {
  return {
    id,
    projectId: 10,
    name: `Sprint ${id}`,
    goal: null,
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('BacklogStore', () => {
  let api: {
    getWorkItems: ReturnType<typeof vi.fn>;
    listSprints: ReturnType<typeof vi.fn>;
    createSprint: ReturnType<typeof vi.fn>;
    startSprint: ReturnType<typeof vi.fn>;
    completeSprint: ReturnType<typeof vi.fn>;
    updateWorkItemSprint: ReturnType<typeof vi.fn>;
  };
  let store: BacklogStore;

  beforeEach(() => {
    api = {
      getWorkItems: vi.fn(),
      listSprints: vi.fn(),
      createSprint: vi.fn(),
      startSprint: vi.fn(),
      completeSprint: vi.fn(),
      updateWorkItemSprint: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [BacklogStore, { provide: BacklogApiService, useValue: api }],
    });
    store = TestBed.inject(BacklogStore);
  });

  it('loads items and sprints and separates backlog items from sprint items', () => {
    const backlog = item(1);
    const planned = item(2, 7);
    api.getWorkItems.mockReturnValue(of([backlog, planned]));
    api.listSprints.mockReturnValue(of([sprint(7)]));

    store.load(10);

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.backlogItems()).toEqual([backlog]);
    expect(store.itemsBySprint()[7]).toEqual([planned]);
  });

  it('clears loading and exposes server detail when loading fails', () => {
    api.getWorkItems.mockReturnValue(throwError(() => ({ error: { detail: 'No autorizado' } })));
    api.listSprints.mockReturnValue(of([]));

    store.load(10);

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('No autorizado');
  });

  it('creates a sprint and appends it', () => {
    const created = sprint(8);
    api.createSprint.mockReturnValue(of(created));

    store.createSprint(10, {
      name: 'Sprint 8',
      goal: null,
      startDate: '2026-02-01',
      endDate: '2026-02-14',
    });

    expect(api.createSprint).toHaveBeenCalledWith(10, expect.any(Object));
    expect(store.sprints()).toEqual([created]);
    expect(store.success()).toBe('Cambios guardados.');
  });

  it('starts and completes sprints by replacing the server response', () => {
    const planned = sprint(7);
    api.createSprint.mockReturnValue(of(planned));
    api.startSprint.mockReturnValue(of({ ...planned, status: 'ACTIVE' }));
    store.createSprint(10, { name: planned.name, startDate: planned.startDate, endDate: planned.endDate });
    store.startSprint(planned);

    expect(api.startSprint).toHaveBeenCalledWith(7);
    expect(store.sprints()[0].status).toBe('ACTIVE');

    api.completeSprint.mockReturnValue(of({ ...planned, status: 'COMPLETED' }));
    store.completeSprint({ ...planned, status: 'ACTIVE' });

    expect(api.completeSprint).toHaveBeenCalledWith(7);
    expect(store.sprints()[0].status).toBe('COMPLETED');
  });

  it('assigns and unassigns an item while preserving its update payload', () => {
    const original = item(1, null, 9);
    const updated = item(1, 7, 9);
    api.getWorkItems.mockReturnValue(of([original]));
    api.listSprints.mockReturnValue(of([sprint(7)]));
    store.load(10);
    api.updateWorkItemSprint.mockReturnValue(of(updated));

    store.assignItem(original, 7);
    expect(api.updateWorkItemSprint).toHaveBeenCalledWith(1, {
      title: original.title,
      description: original.description,
      assignedUserId: original.assignedUserId,
      sprintId: 7,
    });
    expect(store.items()[0].sprintId).toBe(7);

    const unassigned = item(1, null, 9);
    api.updateWorkItemSprint.mockReturnValue(of(unassigned));
    store.assignItem(updated, null);

    expect(api.updateWorkItemSprint).toHaveBeenLastCalledWith(1, {
      title: updated.title,
      description: updated.description,
      assignedUserId: updated.assignedUserId,
      sprintId: null,
    });
    expect(store.backlogItems()[0].sprintId).toBeNull();
  });

  it('surfaces mutation errors and clears the busy flag', () => {
    api.startSprint.mockReturnValue(throwError(() => ({})));
    store.startSprint(sprint(7));

    expect(store.mutating()).toBe(false);
    expect(store.error()).toBe('No se pudo guardar el cambio');
  });
});
