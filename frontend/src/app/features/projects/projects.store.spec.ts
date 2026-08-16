import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Project, ProjectCreateRequest } from './project.model';
import { ProjectsApiService } from './projects-api.service';
import { ProjectsStore } from './projects.store';

function createRequest(overrides: Partial<ProjectCreateRequest> = {}): ProjectCreateRequest {
  return {
    name: 'Nuevo',
    description: null,
    code: null,
    startDate: null,
    estimatedEndDate: null,
    technologies: null,
    repositoryUrl: null,
    ...overrides,
  };
}

function project(id: number, name = `Project ${id}`): Project {
  return {
    id,
    name,
    description: `Description ${id}`,
    status: 'PLANIFICACION',
    ownerId: 7,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    code: null,
    startDate: null,
    estimatedEndDate: null,
    technologies: null,
    repositoryUrl: null,
  };
}

describe('ProjectsStore', () => {
  let apiSpy: {
    listProjects: ReturnType<typeof vi.fn>;
    createProject: ReturnType<typeof vi.fn>;
    getProject: ReturnType<typeof vi.fn>;
    updateProject: ReturnType<typeof vi.fn>;
    updateProjectStatus: ReturnType<typeof vi.fn>;
    deleteProject: ReturnType<typeof vi.fn>;
  };
  let store: ProjectsStore;

  beforeEach(() => {
    apiSpy = {
      listProjects: vi.fn(),
      createProject: vi.fn(),
      getProject: vi.fn(),
      updateProject: vi.fn(),
      updateProjectStatus: vi.fn(),
      deleteProject: vi.fn(),
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

  it('starts with creating false and lastCreated null', () => {
    expect(store.creating()).toBe(false);
    expect(store.lastCreated()).toBeNull();
  });

  it('sets creating true synchronously while the create request is in flight', () => {
    apiSpy.createProject.mockReturnValue({
      subscribe: () => {
        /* never resolves — proves the flag flips before any response arrives */
      },
    });

    store.createProject(createRequest());

    expect(store.creating()).toBe(true);
  });

  it('appends the created project to the list and sets lastCreated on success, without refetching', () => {
    apiSpy.listProjects.mockReturnValue(of([project(1)]));
    store.loadProjects();
    const created = project(9, 'Recién creado');
    apiSpy.createProject.mockReturnValue(of(created));

    store.createProject(createRequest({ name: 'Recién creado', description: 'Description 9' }));

    expect(apiSpy.listProjects).toHaveBeenCalledTimes(1);
    expect(store.projects()).toEqual([project(1), created]);
    expect(store.lastCreated()).toEqual(created);
    expect(store.creating()).toBe(false);
  });

  it('sends the create request object to the API unchanged', () => {
    apiSpy.createProject.mockReturnValue(of(project(9)));

    store.createProject({
      name: 'Nuevo',
      description: 'Detalle',
      code: null,
      startDate: null,
      estimatedEndDate: null,
      technologies: null,
      repositoryUrl: null,
    });

    expect(apiSpy.createProject).toHaveBeenCalledWith({
      name: 'Nuevo',
      description: 'Detalle',
      code: null,
      startDate: null,
      estimatedEndDate: null,
      technologies: null,
      repositoryUrl: null,
    });
  });

  it('sends all five optional rich fields to the API when populated', () => {
    apiSpy.createProject.mockReturnValue(of(project(10)));

    store.createProject({
      name: 'Proyecto rico',
      description: null,
      code: 'PRJ10',
      startDate: '2026-01-01',
      estimatedEndDate: '2026-06-01',
      technologies: 'Angular, Spring Boot',
      repositoryUrl: 'https://github.com/org/repo10',
    });

    expect(apiSpy.createProject).toHaveBeenCalledWith({
      name: 'Proyecto rico',
      description: null,
      code: 'PRJ10',
      startDate: '2026-01-01',
      estimatedEndDate: '2026-06-01',
      technologies: 'Angular, Spring Boot',
      repositoryUrl: 'https://github.com/org/repo10',
    });
  });

  it('sets an error and clears creating on failure, leaving the list untouched', () => {
    apiSpy.listProjects.mockReturnValue(of([project(1)]));
    store.loadProjects();
    apiSpy.createProject.mockReturnValue(
      throwError(() => ({ error: { detail: 'El nombre no puede estar vacío' } })),
    );

    store.createProject(createRequest({ name: '' }));

    expect(store.error()).toBe('El nombre no puede estar vacío');
    expect(store.projects()).toEqual([project(1)]);
    expect(store.creating()).toBe(false);
    expect(store.lastCreated()).toBeNull();
  });

  it('falls back to a default create error message when the ProblemDetail has no detail field', () => {
    apiSpy.createProject.mockReturnValue(throwError(() => ({})));

    store.createProject(createRequest());

    expect(store.error()).toBe('No se pudo crear el proyecto');
  });

  it('loads and selects a project detail', () => {
    const selected = project(4, 'Detalle');
    apiSpy.getProject.mockReturnValue(of(selected));

    store.loadProject(4);

    expect(apiSpy.getProject).toHaveBeenCalledWith(4);
    expect(store.selectedProject()).toEqual(selected);
    expect(store.detailLoading()).toBe(false);
  });

  it('updates the selected project and replaces it in the list', () => {
    const existing = project(4);
    const updated = project(4, 'Renombrado');
    apiSpy.listProjects.mockReturnValue(of([existing]));
    store.loadProjects();
    apiSpy.updateProject.mockReturnValue(of(updated));

    store.updateProject(4, createRequest({ name: 'Renombrado' }));

    expect(apiSpy.updateProject).toHaveBeenCalledWith(4, createRequest({ name: 'Renombrado' }));
    expect(store.selectedProject()).toEqual(updated);
    expect(store.projects()).toEqual([updated]);
    expect(store.saving()).toBe(false);
  });

  it('sends status updates and removes a deleted project', () => {
    const existing = project(4);
    apiSpy.listProjects.mockReturnValue(of([existing, project(5)]));
    store.loadProjects();
    const active = { ...existing, status: 'ACTIVO' as const };
    apiSpy.updateProjectStatus.mockReturnValue(of(active));
    apiSpy.deleteProject.mockReturnValue(of(void 0));

    store.updateProjectStatus(4, 'ACTIVO');
    store.deleteProject(4);

    expect(apiSpy.updateProjectStatus).toHaveBeenCalledWith(4, { status: 'ACTIVO' });
    expect(apiSpy.deleteProject).toHaveBeenCalledWith(4);
    expect(store.projects()).toEqual([project(5)]);
    expect(store.selectedProject()).toBeNull();
  });

  it('keeps the selected project and exposes delete errors when deletion fails', async () => {
    const existing = project(4);
    apiSpy.getProject.mockReturnValue(of(existing));
    store.loadProject(4);
    apiSpy.deleteProject.mockReturnValue(throwError(() => ({ error: { detail: 'No se pudo eliminar' } })));

    const deleted = await store.deleteProject(4);

    expect(deleted).toBe(false);
    expect(store.selectedProject()).toEqual(existing);
    expect(store.error()).toBe('No se pudo eliminar');
    expect(store.deleting()).toBe(false);
  });
});
