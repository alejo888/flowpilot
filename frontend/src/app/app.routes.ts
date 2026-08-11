import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'projects/:projectId/board',
    canActivate: [authGuard],
    loadComponent: () => import('./features/board/board.component').then((m) => m.BoardComponent)
  },
  {
    path: 'admin/users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin-users/admin-users.component').then((m) => m.AdminUsersComponent)
  },
  {
    path: 'admin/permissions',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin-permissions/admin-permissions.component').then(
        (m) => m.AdminPermissionsComponent
      )
  }
];
