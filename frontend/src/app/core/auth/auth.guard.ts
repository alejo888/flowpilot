import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AccessNoticeStore } from '../notifications/access-notice.store';
import { AuthStore } from './auth.store';

/**
 * Authenticated-only route guard (spec: authenticated-only route access).
 * Redirects unauthenticated navigation to `/login?returnUrl=<requested URL>`
 * so {@link LoginComponent} can navigate back after a successful login
 * (design D4 — query param, not router state, because `createUrlTree` has
 * no `state` option).
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Admin-only route guard (spec: admin-only route access; design D6 — fail
 * closed). Composed after {@link authGuard} in route config but is
 * self-sufficient: unauthenticated navigation redirects to `/login` exactly
 * like `authGuard`. An authenticated non-admin (including an undecodable or
 * unrecognized role claim, since `AuthStore.isAdmin` is `false` in that case)
 * is denied and redirected home with a transient notice.
 */
export const adminGuard: CanActivateFn = (_route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (authStore.isAdmin()) {
    return true;
  }

  const accessNotice = inject(AccessNoticeStore);
  accessNotice.denyAdmin();
  return router.createUrlTree(['']);
};
