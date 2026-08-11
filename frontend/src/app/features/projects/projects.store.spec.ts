import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Project } from './project.model';
import { ProjectsApiService } from './projects-api.service';
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

describe('ProjectsStore', () => {
  let apiSpy: {
    listProjects: ReturnType<typeof vi.fn>;
  };
  let store: ProjectsStore;

  beforeEach(() => {
    apiSpy = {
      listProjects: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [ProjectsStore, { provide: ProjectsApiService, useValue: apiSpy }],
    });
    store = TestBed.inject(ProjectsStore);
  });

  it('starts with an empty list and loading false', () => {
    expect(store.projects()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('sets loading true synchronously while the request is in flight', () => {
    apiSpy.listProjects.mockReturnValue({
      subscribe: () => {
        /* never resolves — proves the flag flips before any response arrives */
      },
    });

    store.loadProjects();

    expect(store.loading()).toBe(true);
  });

  it('loads the project list on success and clears the loading flag', () => {
    apiSpy.listProjects.mockReturnValue(of([project(1), project(2, 'Project Two')]));

    store.loadProjects();

    expect(store.projects()).toHaveLength(2);
    expect(store.projects()[1].name).toBe('Project Two');
    expect(store.loading()).toBe(false);
  });

  it('extracts the ProblemDetail detail message on failure and clears loading', () => {
    apiSpy.listProjects.mockReturnValue(
      throwError(() => ({ error: { detail: 'No se pudieron cargar los proyectos: DB down' } })),
    );

    store.loadProjects();

    expect(store.error()).toBe('No se pudieron cargar los proyectos: DB down');
    expect(store.projects()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('falls back to a default error message when the ProblemDetail has no detail field', () => {
    apiSpy.listProjects.mockReturnValue(throwError(() => ({})));

    store.loadProjects();

    expect(store.error()).toBe('No se pudieron cargar los proyectos');
  });
});
