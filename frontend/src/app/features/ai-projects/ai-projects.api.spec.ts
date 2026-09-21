import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AiProjectsApiService } from './ai-projects.api';
import { ProjectWithBacklogRequest } from './ai-projects.model';

describe('AiProjectsApiService', () => {
  let service: AiProjectsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiProjectsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiProjectsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the description to /api/ai/project-draft', () => {
    const draft = {
      name: 'N',
      description: 'D',
      technologies: null,
      epics: [],
      generatedBy: 'STUB' as const,
      model: null,
    };
    let received: unknown;
    service.generateDraft({ description: 'Una app' }).subscribe((r) => (received = r));

    const req = httpMock.expectOne('/api/ai/project-draft');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ description: 'Una app' });
    req.flush(draft);
    expect(received).toEqual(draft);
  });

  it('POSTs the full payload to /api/projects/with-backlog', () => {
    const body: ProjectWithBacklogRequest = {
      name: 'N',
      description: null,
      code: 'ABC',
      technologies: null,
      epics: [{ title: 'E', description: null, stories: [{ title: 'S', description: 'd' }] }],
      aiGenerated: true,
      aiModel: 'llama3',
    };
    service.createProjectWithBacklog(body).subscribe();

    const req = httpMock.expectOne('/api/projects/with-backlog');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 5 });
  });
});
