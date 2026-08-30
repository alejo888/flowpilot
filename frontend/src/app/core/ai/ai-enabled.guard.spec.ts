import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, convertToParamMap } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AiConfigService } from './ai-config.service';
import { aiEnabledGuard } from './ai-enabled.guard';

describe('aiEnabledGuard', () => {
  let aiConfigStub: { whenLoaded: ReturnType<typeof vi.fn>; aiEnabled: () => boolean };
  let router: Router;

  function runGuard(
    url = '/projects/7/ai/user-stories',
    projectId: string | null = '7',
  ): Promise<boolean | UrlTree> {
    const state = { url } as RouterStateSnapshot;
    const route = {
      paramMap: convertToParamMap(projectId ? { projectId } : {}),
    } as ActivatedRouteSnapshot;
    return Promise.resolve(
      TestBed.runInInjectionContext(() => aiEnabledGuard(route, state)) as
        | boolean
        | UrlTree
        | Promise<boolean | UrlTree>,
    );
  }

  beforeEach(() => {
    aiConfigStub = { whenLoaded: vi.fn(), aiEnabled: () => false };

    TestBed.configureTestingModule({
      providers: [{ provide: AiConfigService, useValue: aiConfigStub }],
    });
    router = TestBed.inject(Router);
  });

  it('allows activation when /api/ai/config resolves enabled', async () => {
    aiConfigStub.whenLoaded.mockResolvedValue(true);

    await expect(runGuard()).resolves.toBe(true);
    expect(aiConfigStub.whenLoaded).toHaveBeenCalledTimes(1);
  });

  it('blocks the AI screen and redirects to the project detail when AI is disabled', async () => {
    aiConfigStub.whenLoaded.mockResolvedValue(false);

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects/7');
  });

  it('fails closed and redirects when the AI config lookup rejects', async () => {
    aiConfigStub.whenLoaded.mockRejectedValue(new Error('network down'));

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects/7');
  });

  it('redirects to the projects list when the route carries no projectId', async () => {
    aiConfigStub.whenLoaded.mockResolvedValue(false);

    const result = await runGuard('/projects//ai/user-stories', null);

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/projects');
  });
});
