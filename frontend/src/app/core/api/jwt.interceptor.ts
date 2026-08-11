import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

import { AuthStore } from '../auth/auth.store';

/**
 * Functional interceptor (spec: frontend-http-auth; design decision "401
 * handling and refresh concurrency"). Attaches the bearer token to every
 * non-`/api/auth/*` request, and on a 401 delegates to {@link AuthStore.refresh}
 * (single-flight there) before retrying the original request exactly once.
 * The retry itself carries no `catchError` — a second 401 propagates to the
 * caller unmodified, which is what breaks any retry loop.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  if (isAuthEndpoint(req.url)) {
    return next(req);
  }

  const token = authStore.accessToken();
  const outgoing = token ? withBearer(req, token) : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      if (token && error instanceof HttpErrorResponse && error.status === 401) {
        return authStore.refresh().pipe(
          switchMap((freshToken): Observable<HttpEvent<unknown>> => next(withBearer(req, freshToken))),
          catchError(() => {
            authStore.clear();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};

function isAuthEndpoint(url: string): boolean {
  return (
    url.startsWith('/api/auth/') ||
    (url.includes('//') && new URL(url, location.origin).pathname.startsWith('/api/auth/'))
  );
}

function withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
