import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AiConfigService } from './ai-config.service';

describe('AiConfigService', () => {
  let service: AiConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AiConfigService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('is fail-closed: aiEnabled() is false before any load', () => {
    expect(service.aiEnabled()).toBe(false);
  });

  it('GETs /api/ai/config and flips aiEnabled() when the backend reports enabled', () => {
    service.load();

    const request = httpMock.expectOne('/api/ai/config');
    expect(request.request.method).toBe('GET');
    request.flush({ enabled: true });

    expect(service.aiEnabled()).toBe(true);
  });

  it('keeps aiEnabled() false when the backend reports disabled', () => {
    service.load();
    httpMock.expectOne('/api/ai/config').flush({ enabled: false });

    expect(service.aiEnabled()).toBe(false);
  });

  it('stays fail-closed when the config request errors', () => {
    service.load();
    httpMock
      .expectOne('/api/ai/config')
      .flush({ detail: 'No autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.aiEnabled()).toBe(false);
  });

  it('does not fire a second request while one is already in flight', () => {
    service.load();
    service.load();

    httpMock.expectOne('/api/ai/config').flush({ enabled: true });
    httpMock.verify();
    expect(service.aiEnabled()).toBe(true);
  });
});
