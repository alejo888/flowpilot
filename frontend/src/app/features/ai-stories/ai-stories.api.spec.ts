import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AiStoriesApiService } from './ai-stories.api';
import { GeneratedUserStoryResponse } from './ai-stories.model';

function response(overrides: Partial<GeneratedUserStoryResponse> = {}): GeneratedUserStoryResponse {
  return {
    userStory: {
      role: 'usuario registrado',
      action: 'exportar mis tareas',
      benefit: 'compartirlas con mi equipo',
      text: 'Como usuario registrado quiero exportar mis tareas para compartirlas con mi equipo',
    },
    acceptanceCriteria: ['Dado un proyecto, cuando exporto, entonces recibo un archivo'],
    generatedBy: 'STUB',
    model: null,
    ...overrides,
  };
}

describe('AiStoriesApiService', () => {
  let service: AiStoriesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiStoriesApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiStoriesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the requirement to the project-scoped AI endpoint', () => {
    let received: GeneratedUserStoryResponse | undefined;
    service.generateUserStory(10, { requirement: 'Necesito exportar tareas' }).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/ai/user-stories');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ requirement: 'Necesito exportar tareas' });

    const body = response();
    request.flush(body);
    expect(received).toEqual(body);
  });

  it('propagates a backend error to the caller', () => {
    let failed = false;
    service
      .generateUserStory(7, { requirement: 'algo' })
      .subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne('/api/projects/7/ai/user-stories')
      .flush({ detail: 'El asistente de IA no está disponible en este momento.' }, { status: 503, statusText: 'Service Unavailable' });

    expect(failed).toBe(true);
  });
});
