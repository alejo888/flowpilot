import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AiCriteriaApiService } from './ai-criteria.api';
import { GeneratedAcceptanceCriteriaResponse } from './board.model';

describe('AiCriteriaApiService', () => {
  let service: AiCriteriaApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiCriteriaApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiCriteriaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the workItemId to the project-scoped AI acceptance-criteria endpoint', () => {
    let received: GeneratedAcceptanceCriteriaResponse | undefined;
    service.generate(10, 55).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/ai/acceptance-criteria');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ workItemId: 55 });

    const body: GeneratedAcceptanceCriteriaResponse = {
      criteria: ['Dado A cuando B entonces C'],
      generatedBy: 'OLLAMA',
      model: 'llama3',
    };
    request.flush(body);
    expect(received).toEqual(body);
  });

  it('propagates the Spanish 503 detail to the caller', () => {
    let detail: string | undefined;
    service.generate(7, 3).subscribe({
      error: (err: { error?: { detail?: string } }) => (detail = err.error?.detail),
    });

    httpMock
      .expectOne('/api/projects/7/ai/acceptance-criteria')
      .flush(
        { detail: 'El asistente de IA no está disponible en este momento.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(detail).toBe('El asistente de IA no está disponible en este momento.');
  });
});
