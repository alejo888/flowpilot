import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RiskAnalysisApiService } from './risk-analysis.api';
import { RiskAnalysisResponse } from './risk-analysis.model';

describe('RiskAnalysisApiService', () => {
  let service: RiskAnalysisApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RiskAnalysisApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RiskAnalysisApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs a body-less request to the project-scoped risk-analysis endpoint', () => {
    let received: RiskAnalysisResponse | undefined;
    service.analyze(10).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/ai/risk-analysis');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();

    const body: RiskAnalysisResponse = {
      signals: [{ type: 'STALLED_ITEM', severity: 'LOW', title: 't', detail: 'd', workItemId: 4 }],
      summary: 'Resumen',
      recommendations: ['Revisar'],
      generatedBy: 'STUB',
      model: null,
    };
    request.flush(body);
    expect(received).toEqual(body);
  });

  it('propagates the Spanish 503 detail to the caller', () => {
    let detail: string | undefined;
    service.analyze(7).subscribe({
      error: (err: { error?: { detail?: string } }) => (detail = err.error?.detail),
    });

    httpMock
      .expectOne('/api/projects/7/ai/risk-analysis')
      .flush(
        { detail: 'El asistente de IA no está disponible en este momento.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(detail).toBe('El asistente de IA no está disponible en este momento.');
  });
});
