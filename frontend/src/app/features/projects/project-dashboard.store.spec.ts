import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { ProjectDashboardApiService } from './project-dashboard-api.service';
import { ProjectDashboard } from './project-dashboard.model';
import { ProjectDashboardStore } from './project-dashboard.store';

function dashboard(totalItems: number): ProjectDashboard {
  return {
    totalItems,
    completedItems: 0,
    columnCounts: [],
    activeSprint: null,
    activeSprintTotalItems: 0,
    activeSprintCompletedItems: 0,
    backlogPendingCount: 0,
    workload: [],
    priorityDistribution: {},
  };
}

describe('ProjectDashboardStore', () => {
  let apiSpy: { get: ReturnType<typeof vi.fn> };
  let store: ProjectDashboardStore;

  beforeEach(() => {
    apiSpy = { get: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ProjectDashboardStore,
        { provide: ProjectDashboardApiService, useValue: apiSpy },
      ],
    });
    store = TestBed.inject(ProjectDashboardStore);
  });

  it('clears the previous project dashboard as soon as a new load starts', () => {
    apiSpy.get.mockReturnValueOnce(of(dashboard(5)));
    store.load(1);
    expect(store.dashboard()?.totalItems).toBe(5);

    // Store is providedIn:'root' — project 1's metrics must not stay on screen
    // while project 2's request is still in flight.
    apiSpy.get.mockReturnValueOnce(new Subject<ProjectDashboard>());
    store.load(2);

    expect(store.dashboard()).toBeNull();
    expect(store.loading()).toBe(true);
  });

  it('ignores a late response for an older project id', () => {
    const first = new Subject<ProjectDashboard>();
    const second = new Subject<ProjectDashboard>();
    apiSpy.get.mockReturnValueOnce(first).mockReturnValueOnce(second);

    store.load(1);
    store.load(2);

    second.next(dashboard(2));
    second.complete();
    expect(store.dashboard()?.totalItems).toBe(2);

    first.next(dashboard(1));
    first.complete();

    expect(store.dashboard()?.totalItems).toBe(2);
  });

  it('surfaces the backend detail message on failure', () => {
    const error$ = new Subject<ProjectDashboard>();
    apiSpy.get.mockReturnValueOnce(error$ as never);

    store.load(1);
    error$.error({ error: { detail: 'No autorizado para ver el dashboard del proyecto' } });

    expect(store.error()).toBe('No autorizado para ver el dashboard del proyecto');
    expect(store.dashboard()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('falls back to a generic message when the backend detail is missing', () => {
    const error$ = new Subject<ProjectDashboard>();
    apiSpy.get.mockReturnValueOnce(error$ as never);

    store.load(1);
    error$.error({});

    expect(store.error()).toBe('No se pudo cargar el dashboard');
  });
});
