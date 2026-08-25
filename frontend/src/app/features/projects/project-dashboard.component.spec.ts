import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProjectDashboard } from './project-dashboard.model';
import { ProjectDashboardComponent } from './project-dashboard.component';
import { ProjectDashboardStore } from './project-dashboard.store';

function dashboard(overrides: Partial<ProjectDashboard> = {}): ProjectDashboard {
  return {
    totalItems: 5,
    completedItems: 2,
    columnCounts: [
      { columnId: 1, name: 'Por hacer', count: 3 },
      { columnId: 2, name: 'Terminado', count: 2 },
    ],
    activeSprint: null,
    activeSprintTotalItems: 0,
    activeSprintCompletedItems: 0,
    backlogPendingCount: 3,
    workload: [{ assigneeId: 1, assigneeName: 'Ada', count: 2 }],
    priorityDistribution: { LOW: 1, MEDIUM: 2, HIGH: 1, URGENT: 1 },
    ...overrides,
  };
}

describe('ProjectDashboardComponent', () => {
  let fixture: ComponentFixture<ProjectDashboardComponent>;
  let storeStub: {
    dashboard: ReturnType<typeof signal<ProjectDashboard | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    load: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeStub = {
      dashboard: signal(null),
      loading: signal(false),
      error: signal(null),
      load: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDashboardComponent],
      providers: [provideRouter([]), { provide: ProjectDashboardStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDashboardComponent);
    fixture.componentRef.setInput('projectId', '10');
  });

  it('renders the loading state', () => {
    storeStub.loading.set(true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando métricas');
  });

  it('renders the metrics once loaded, including Spanish priority labels', () => {
    storeStub.dashboard.set(dashboard());
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('5');
    expect(text).toContain('Terminado');
    expect(text).toContain('Baja');
    expect(text).toContain('Media');
    expect(text).toContain('Alta');
    expect(text).toContain('Urgente');
    expect(text).not.toContain('LOW');
  });

  it('renders a fallback label when an assignee name is missing', () => {
    storeStub.dashboard.set(dashboard({ workload: [{ assigneeId: 1, assigneeName: null, count: 4 }] }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Usuario desconocido');
  });

  it('renders an error message on failure', () => {
    storeStub.error.set('No se pudo cargar el dashboard');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudo cargar el dashboard');
  });
});
