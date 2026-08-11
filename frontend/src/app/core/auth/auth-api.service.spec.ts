import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withNoXsrfProtection } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccessTokenResponse } from './auth.model';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApiService,
        provideHttpClient(withNoXsrfProtection()),
        provideHttpClientTesting(),
        { provide: DOCUMENT, useValue: { cookie: 'XSRF-TOKEN=csrf-abc123' } },
      ],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts credentials to /api/auth/login without a CSRF header', () => {
    const response: AccessTokenResponse = { accessToken: 'token-1', expiresIn: 900 };
    let result: AccessTokenResponse | undefined;

    service
      .login({ email: 'user@flowpilot.local', password: 'secret' })
      .subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@flowpilot.local', password: 'secret' });
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('posts to /api/auth/refresh with the X-XSRF-TOKEN header echoing the cookie', () => {
    const response: AccessTokenResponse = { accessToken: 'token-2', expiresIn: 900 };
    let result: AccessTokenResponse | undefined;

    service.refresh().subscribe((res) => (result = res));

    const req = httpMock.expectOne('/api/auth/refresh');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-abc123');
    req.flush(response);

    expect(result).toEqual(response);
  });

  it('posts to /api/auth/logout with the X-XSRF-TOKEN header echoing the cookie', () => {
    let completed = false;

    service.logout().subscribe(() => (completed = true));

    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-abc123');
    req.flush(null);

    expect(completed).toBe(true);
  });
});
