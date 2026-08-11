import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'projects/:projectId/board',
    loadComponent: () => import('./features/board/board.component').then((m) => m.BoardComponent)
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/admin-users/admin-users.component').then((m) => m.AdminUsersComponent)
  },
  {
    path: 'admin/permissions',
    loadComponent: () =>
      import('./features/admin-permissions/admin-permissions.component').then(
        (m) => m.AdminPermissionsComponent
      )
  }
];
