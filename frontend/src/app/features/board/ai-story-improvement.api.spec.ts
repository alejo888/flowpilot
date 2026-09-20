import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GeneratedUserStoryResponse } from '../ai-stories/ai-stories.model';
import { AiStoryImprovementApiService } from './ai-story-improvement.api';

describe('AiStoryImprovementApiService', () => {
  let service: AiStoryImprovementApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiStoryImprovementApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiStoryImprovementApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs the workItemId to the project-scoped story-improvement endpoint', () => {
    let received: GeneratedUserStoryResponse | undefined;
    service.improve(10, 55).subscribe((r) => (received = r));

    const request = httpMock.expectOne('/api/projects/10/ai/story-improvement');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ workItemId: 55 });

    const body: GeneratedUserStoryResponse = {
      userStory: { role: 'PM', action: 'ver', benefit: 'decidir', text: 'Como PM quiero ver para decidir' },
      acceptanceCriteria: ['Dado A cuando B entonces C'],
      generatedBy: 'OLLAMA',
      model: 'llama3',
    };
    request.flush(body);
    expect(received).toEqual(body);
  });

  it('propagates the Spanish 503 detail to the caller', () => {
    let detail: string | undefined;
    service.improve(7, 3).subscribe({
      error: (err: { error?: { detail?: string } }) => (detail = err.error?.detail),
    });

    httpMock
      .expectOne('/api/projects/7/ai/story-improvement')
      .flush(
        { detail: 'El asistente de IA no está disponible en este momento.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(detail).toBe('El asistente de IA no está disponible en este momento.');
  });
});
