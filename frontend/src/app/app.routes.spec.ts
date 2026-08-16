import { adminGuard, authGuard } from './core/auth/auth.guard';
import { HomeComponent } from './features/home/home.component';
import { routes } from './app.routes';

describe('routes', () => {
  function findRoute(path: string) {
    const route = routes.find((r) => r.path === path);
    if (!route) {
      throw new Error(`Route not found: ${path}`);
    }
    return route;
  }

  it('registers a "" route rendering HomeComponent eagerly', () => {
    const homeRoute = findRoute('');
    expect(homeRoute.component).toBe(HomeComponent);
  });

  it('guards the projects list route with authGuard only', () => {
    const projectsRoute = findRoute('projects');
    expect(projectsRoute.canActivate).toEqual([authGuard]);
  });

  it('registers and guards the project detail route with authGuard only', () => {
    const detailRoute = findRoute('projects/:projectId');
    expect(detailRoute.canActivate).toEqual([authGuard]);
    expect(detailRoute.loadComponent).toBeTypeOf('function');
  });

  it('guards the board route with authGuard only', () => {
    const boardRoute = findRoute('projects/:projectId/board');
    expect(boardRoute.canActivate).toEqual([authGuard]);
  });

  it('guards the admin/users route with authGuard and adminGuard', () => {
    const route = findRoute('admin/users');
    expect(route.canActivate).toEqual([authGuard, adminGuard]);
  });

  it('guards the admin/permissions route with authGuard and adminGuard', () => {
    const route = findRoute('admin/permissions');
    expect(route.canActivate).toEqual([authGuard, adminGuard]);
  });
});
