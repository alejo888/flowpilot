import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProjectsApiService } from './projects-api.service';
import { Project, ProjectCreateRequest } from './project.model';

describe('ProjectsApiService', () => {
  let service: ProjectsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProjectsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches the list of projects', () => {
    const projects: Project[] = [
      {
        id: 1,
        name: 'Proyecto Uno',
        description: 'Descripción uno',
        status: 'PLANIFICACION',
        ownerId: 7,
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
        code: null,
        startDate: null,
        estimatedEndDate: null,
        technologies: null,
        repositoryUrl: null,
      },
      {
        id: 2,
        name: 'Proyecto Dos',
        description: null,
        status: 'ACTIVO',
        ownerId: 7,
        createdAt: '2026-08-02T00:00:00Z',
        updatedAt: '2026-08-02T00:00:00Z',
        code: 'PRJ2',
        startDate: '2026-01-01',
        estimatedEndDate: '2026-06-01',
        technologies: 'Angular, Spring Boot',
        repositoryUrl: 'https://github.com/org/repo',
      },
    ];
    let result: Project[] | undefined;

    service.listProjects().subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects');
    expect(req.request.method).toBe('GET');
    req.flush(projects);

    expect(result).toEqual(projects);
  });

  it('creates a project', () => {
    const request: ProjectCreateRequest = {
      name: 'Proyecto Nuevo',
      description: 'Detalle',
      code: 'PRJ3',
      startDate: '2026-02-01',
      estimatedEndDate: '2026-08-01',
      technologies: 'Angular, Spring Boot',
      repositoryUrl: 'https://github.com/org/repo3',
    };
    const created: Project = {
      id: 3,
      name: 'Proyecto Nuevo',
      description: 'Detalle',
      status: 'PLANIFICACION',
      ownerId: 7,
      createdAt: '2026-08-03T00:00:00Z',
      updatedAt: '2026-08-03T00:00:00Z',
      code: 'PRJ3',
      startDate: '2026-02-01',
      estimatedEndDate: '2026-08-01',
      technologies: 'Angular, Spring Boot',
      repositoryUrl: 'https://github.com/org/repo3',
    };
    let result: Project | undefined;

    service.createProject(request).subscribe((response) => (result = response));

    const req = httpMock.expectOne('/api/projects');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(created);

    expect(result).toEqual(created);
  });
});
