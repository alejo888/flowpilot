import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WorkItem } from '../board/board.model';
import { AiSubtasksApiService } from './ai-subtasks.api';
import { GeneratedSubtasksResponse, WorkItemBatchCreateRequest } from './ai-subtasks.model';

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

  it('POSTs a WorkItemBatchCreateRequest to the transactional batch endpoint', () => {
    const batch: WorkItemBatchCreateRequest = {
      columnId: 3,
      parentWorkItemId: 55,
      sprintId: 8,
      aiGenerated: true,
      aiModel: 'llama3',
      subtasks: [
        { title: 'Diseñar', description: 'algo' },
        { title: 'Implementar', description: '' },
      ],
    };
    let received: WorkItem[] | undefined;
    service.createBatch(10, batch).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/work-items/batch');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(batch);

    const created = [{ id: 1 }, { id: 2 }] as WorkItem[];
    request.flush(created);
    expect(received).toEqual(created);
  });

  it('propagates a batch error to the caller', () => {
    let failed = false;
    service
      .createBatch(7, { columnId: 1, subtasks: [{ title: 'x' }] })
      .subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne('/api/projects/7/work-items/batch')
      .flush(
        { detail: 'La columna no pertenece al proyecto' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(failed).toBe(true);
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
