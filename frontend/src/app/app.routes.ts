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
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/projects.component').then((m) => m.ProjectsComponent)
  },
  {
    path: 'projects/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-detail.component').then((m) => m.ProjectDetailComponent)
  },
  {
    path: 'projects/:projectId/board',
    canActivate: [authGuard],
    loadComponent: () => import('./features/board/board.component').then((m) => m.BoardComponent)
  },
  {
    path: 'projects/:projectId/members',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/members/project-members.component').then(
        (m) => m.ProjectMembersComponent
      )
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
