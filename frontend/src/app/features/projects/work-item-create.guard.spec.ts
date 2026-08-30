import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, convertToParamMap } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Project } from './project.model';
import { ProjectsApiService } from './projects-api.service';
import { workItemCreateGuard } from './work-item-create.guard';

function project(callerPermissions: Project['callerPermissions']): Project {
  return {
    id: 7,
    name: 'Proyecto',
    description: null,
    status: 'ACTIVO',
    ownerId: 1,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    code: null,
    startDate: null,
    estimatedEndDate: null,
    technologies: null,
    repositoryUrl: null,
    callerPermissions,
  };
}

describe('workItemCreateGuard', () => {
  let apiStub: { getProject: ReturnType<typeof vi.fn> };

  function runGuard(projectId: string | null = '7'): Promise<boolean | UrlTree> {
    const route = {
      paramMap: convertToParamMap(projectId ? { projectId } : {}),
    } as ActivatedRouteSnapshot;
    const state = { url: '/projects/7/ai/user-stories' } as RouterStateSnapshot;
    return Promise.resolve(
      TestBed.runInInjectionContext(() => workItemCreateGuard(route, state)) as
        | boolean
        | UrlTree
        | Promise<boolean | UrlTree>,
    );
  }

  beforeEach(() => {
    apiStub = { getProject: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectsApiService, useValue: apiStub }],
    });
    TestBed.inject(Router);
  });

  it('allows activation when the caller holds WORKITEM_CREATE', async () => {
    apiStub.getProject.mockReturnValue(of(project(['WORKITEM_CREATE'])));

    await expect(runGuard()).resolves.toBe(true);
    expect(apiStub.getProject).toHaveBeenCalledWith(7);
  });

  it('redirects to the project detail when the caller lacks WORKITEM_CREATE', async () => {
    apiStub.getProject.mockReturnValue(of(project(['PROJECT_EDIT_SETTINGS'])));

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects/7');
  });

  it('fails closed and redirects when the project fetch errors', async () => {
    apiStub.getProject.mockReturnValue(throwError(() => new Error('network down')));

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects/7');
  });

  it('redirects to the projects list when the route carries no projectId', async () => {
    const result = await runGuard(null);

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects');
    expect(apiStub.getProject).not.toHaveBeenCalled();
  });
});
