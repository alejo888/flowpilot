import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStoreStub: {
    accessToken: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authStoreStub = {
      accessToken: vi.fn().mockReturnValue(null),
      refresh: vi.fn(),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: authStoreStub },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not attach an Authorization header to /api/auth/login', () => {
    authStoreStub.accessToken.mockReturnValue('token-1');

    http.post('/api/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not attach an Authorization header to /api/auth/refresh or /api/auth/logout', () => {
    authStoreStub.accessToken.mockReturnValue('token-1');

    http.post('/api/auth/refresh', {}).subscribe();
    http.post('/api/auth/logout', {}).subscribe();

    httpMock.expectOne('/api/auth/refresh').flush({});
    httpMock.expectOne('/api/auth/logout').flush({});
  });

  it('attaches Authorization: Bearer <token> to a protected request when a token is present', () => {
    authStoreStub.accessToken.mockReturnValue('token-abc');

    http.get('/api/board').subscribe();

    const req = httpMock.expectOne('/api/board');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush({});
  });

  it('does not attach an Authorization header to a protected request when no token is present', () => {
    authStoreStub.accessToken.mockReturnValue(null);

    http.get('/api/board').subscribe();

    const req = httpMock.expectOne('/api/board');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('refreshes and retries once on a 401 from a protected request', () => {
    authStoreStub.accessToken.mockReturnValue('stale-token');
    authStoreStub.refresh.mockReturnValue(of('fresh-token'));

    let result: unknown;
    http.get('/api/board').subscribe((res) => (result = res));

    const first = httpMock.expectOne('/api/board');
    expect(first.request.headers.get('Authorization')).toBe('Bearer stale-token');
    first.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authStoreStub.refresh).toHaveBeenCalledTimes(1);

    const retried = httpMock.expectOne('/api/board');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retried.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('routes both concurrent 401s through the store refresh() and retries each with the resulting token', () => {
    // Single-flight de-duplication is AuthStore's own responsibility (covered by
    // auth.store.spec.ts's shareReplay test) — the interceptor simply delegates
    // every failing request to store.refresh() and retries with whatever token
    // that observable resolves to, so a stubbed store that never dedupes still
    // proves the interceptor's per-request retry contract holds under concurrency.
    authStoreStub.accessToken.mockReturnValue('stale-token');
    authStoreStub.refresh.mockReturnValue(of('fresh-token'));

    http.get('/api/board').subscribe();
    http.get('/api/projects').subscribe();

    const boardReq = httpMock.expectOne('/api/board');
    const projectsReq = httpMock.expectOne('/api/projects');
    boardReq.flush(null, { status: 401, statusText: 'Unauthorized' });
    projectsReq.flush(null, { status: 401, statusText: 'Unauthorized' });

    const retriedBoard = httpMock.expectOne('/api/board');
    const retriedProjects = httpMock.expectOne('/api/projects');
    expect(retriedBoard.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(retriedProjects.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retriedBoard.flush({});
    retriedProjects.flush({});

    expect(authStoreStub.refresh).toHaveBeenCalledTimes(2);
  });

  it('clears the store and propagates the original error when refresh also fails', () => {
    authStoreStub.accessToken.mockReturnValue('stale-token');
    authStoreStub.refresh.mockReturnValue(throwError(() => ({ status: 401 })));

    let error: unknown;
    http.get('/api/board').subscribe({ error: (err: unknown) => (error = err) });

    const req = httpMock.expectOne('/api/board');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authStoreStub.clear).toHaveBeenCalledTimes(1);
    expect((error as { status: number }).status).toBe(401);
  });
});
