import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { hasPermission } from './project.model';
import { ProjectsApiService } from './projects-api.service';

/**
 * Route guard for a project-scoped screen whose only outcome is a
 * `WORKITEM_CREATE`-guarded mutation (currently the AI user-story screen).
 * Without it a caller who lacks the permission can deep-link straight to the
 * form and only learn of the 403 on submit — the nav link is already gated the
 * same way (`ProjectDetailComponent.canGenerateAiStories`).
 *
 * Fail-closed: a missing `projectId` or a failed project fetch redirects to the
 * project detail (or the projects list). Composed AFTER {@link authGuard} and,
 * for the AI route, after `aiEnabledGuard`.
 */
export const workItemCreateGuard: CanActivateFn = async (route) => {
  const projectsApi = inject(ProjectsApiService);
  const router = inject(Router);

  const projectId = route.paramMap.get('projectId');
  if (!projectId) {
    return router.createUrlTree(['/projects']);
  }

  const project = await firstValueFrom(projectsApi.getProject(Number(projectId))).catch(() => null);
  return hasPermission(project, 'WORKITEM_CREATE')
    ? true
    : router.createUrlTree(['/projects', projectId]);
};
