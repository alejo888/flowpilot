import { provideHttpClient, withInterceptors, withNoXsrfProtection } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { jwtInterceptor } from './core/api/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // withNoXsrfProtection(): Angular's built-in XSRF interceptor shares the
    // same XSRF-TOKEN/X-XSRF-TOKEN cookie/header names as our explicit
    // double-submit implementation (AuthApiService + xsrf-cookie.ts) and would
    // otherwise attach a stray X-XSRF-TOKEN to /api/auth/login whenever a
    // stale cookie exists from a prior session, violating the spec's "login
    // has no CSRF header" requirement.
    provideHttpClient(withInterceptors([jwtInterceptor]), withNoXsrfProtection()),
    // Bootstrap re-hydration (spec: frontend-auth-session, "Bootstrap
    // hydration on app start"): await AuthStore.hydrate() before the app
    // renders so isAuthenticated() is settled before the first protected call.
    provideAppInitializer(() => inject(AuthStore).hydrate())
  ]
};
