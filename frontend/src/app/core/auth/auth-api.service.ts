import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AccessTokenResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from './auth.model';
import { xsrfHeader } from './xsrf-cookie';

/**
 * Thin HTTP client for the auth session lifecycle (spec: frontend-auth-session,
 * frontend-http-auth). Uses relative `/api/...` paths per the same convention
 * as {@link BoardApiService}. `login`/`register`/`forgotPassword`/`resetPassword`
 * all exclude the CSRF header (none of them ride on an existing session);
 * `refresh`/`logout` are cookie-authenticated and require the double-submit
 * `X-XSRF-TOKEN` header (design decision D8).
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  login(request: LoginRequest): Observable<AccessTokenResponse> {
    return this.http.post<AccessTokenResponse>('/api/auth/login', request);
  }

  register(request: RegisterRequest): Observable<void> {
    return this.http.post<void>('/api/auth/register', request);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>('/api/auth/forgot-password', request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>('/api/auth/reset-password', request);
  }

  refresh(): Observable<AccessTokenResponse> {
    return this.http.post<AccessTokenResponse>('/api/auth/refresh', null, {
      headers: xsrfHeader(this.document),
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null, {
      headers: xsrfHeader(this.document),
    });
  }
}
