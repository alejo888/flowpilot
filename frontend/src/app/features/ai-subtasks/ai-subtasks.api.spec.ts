import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AiSubtasksApiService } from './ai-subtasks.api';
import { GeneratedSubtasksResponse } from './ai-subtasks.model';

function response(overrides: Partial<GeneratedSubtasksResponse> = {}): GeneratedSubtasksResponse {
  return {
    subtasks: [
      { title: 'Diseñar el formulario', description: 'Definir campos y validaciones' },
      { title: 'Implementar el endpoint', description: 'Crear la ruta y el servicio' },
    ],
    generatedBy: 'STUB',
    model: null,
    ...overrides,
  };
}

describe('AiSubtasksApiService', () => {
  let service: AiSubtasksApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiSubtasksApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiSubtasksApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs a workItemId to the project-scoped AI subtasks endpoint (mode a)', () => {
    let received: GeneratedSubtasksResponse | undefined;
    service.generateSubtasks(10, { workItemId: 55 }).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/ai/subtasks');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ workItemId: 55 });

    const body = response();
    request.flush(body);
    expect(received).toEqual(body);
  });

  it('POSTs free text (mode b)', () => {
    service.generateSubtasks(7, { storyText: 'Como usuario quiero exportar datos' }).subscribe();

    const request = httpMock.expectOne('/api/projects/7/ai/subtasks');
    expect(request.request.body).toEqual({ storyText: 'Como usuario quiero exportar datos' });
    request.flush(response());
  });

  it('propagates a backend error to the caller', () => {
    let failed = false;
    service.generateSubtasks(7, { storyText: 'algo' }).subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne('/api/projects/7/ai/subtasks')
      .flush(
        { detail: 'El asistente de IA no está disponible en este momento.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(failed).toBe(true);
  });
});
