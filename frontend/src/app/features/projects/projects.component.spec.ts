import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Project } from './project.model';
import { ProjectsComponent } from './projects.component';
import { ProjectsStore } from './projects.store';

function project(id: number, name = `Project ${id}`): Project {
  return {
    id,
    name,
    description: `Description ${id}`,
    status: 'PLANIFICACION',
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
}

describe('ProjectsComponent', () => {
  let fixture: ComponentFixture<ProjectsComponent>;
  let storeStub: {
    projects: ReturnType<typeof signal<Project[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    loadProjects: ReturnType<typeof vi.fn>;
  };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [provideRouter([]), { provide: ProjectsStore, useValue: storeStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    storeStub = {
      projects: signal([]),
      loading: signal(false),
      error: signal(null),
      loadProjects: vi.fn(),
    };
  });

  it('loads the project list on init', async () => {
    await setup();

    expect(storeStub.loadProjects).toHaveBeenCalled();
  });

  it('shows the loading state while the store is fetching', async () => {
    storeStub.loading.set(true);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-loading"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="projects-empty"]')).toBeFalsy();
  });

  it('shows the empty state when loading has finished and there are no projects', async () => {
    storeStub.loading.set(false);
    storeStub.projects.set([]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-empty"]')?.textContent).toContain(
      'Todavía no tienes proyectos',
    );
  });

  it('renders each project with name, description, and status', async () => {
    storeStub.projects.set([project(1, 'Alpha'), project(2, 'Beta')]);
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    const names = Array.from(compiled.querySelectorAll('[data-testid="project-row-1"], [data-testid="project-row-2"]'));
    expect(names).toHaveLength(2);
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-board-link"]')?.textContent).toContain('Alpha');
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-description"]')?.textContent).toContain('Description 1');
    expect(compiled.querySelector('[data-testid="project-row-1"] [data-testid="project-status"]')?.textContent).toContain('PLANIFICACION');
  });

  it('displays the store error when the list fails to load', async () => {
    storeStub.error.set('No se pudieron cargar los proyectos');
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="projects-error"]')?.textContent).toContain(
      'No se pudieron cargar los proyectos',
    );
  });
});
