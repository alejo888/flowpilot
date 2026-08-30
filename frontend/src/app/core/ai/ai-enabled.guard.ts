import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AiConfigService } from './ai-config.service';

/**
 * Route guard for the AI user-story screen (spec: ai-runtime-config —
 * "Frontend entrypoint gating"). The feature MUST be unreachable whenever
 * `/api/ai/config` reports `enabled: false`, so hiding only the nav link is
 * not enough — direct navigation to the route is blocked here too.
 *
 * Fail-closed: it waits for a definitive `/api/ai/config` answer (triggering
 * the fetch itself if the app shell has not run it yet, e.g. on a hard load
 * straight to the route) and denies on `false` OR any config error, redirecting
 * to the project detail screen (or the projects list when the URL has no
 * `projectId`). Composed AFTER {@link authGuard} in the route config.
 */
export const aiEnabledGuard: CanActivateFn = async (route, _state) => {
  const aiConfig = inject(AiConfigService);
  const router = inject(Router);

  const enabled = await aiConfig.whenLoaded().catch(() => false);
  if (enabled) {
    return true;
  }

  const projectId = route.paramMap.get('projectId');
  return router.createUrlTree(projectId ? ['/projects', projectId] : ['/projects']);
};
