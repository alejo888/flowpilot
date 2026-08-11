import { Component, OnInit, inject } from '@angular/core';

import { AdminUser, GlobalRole } from './admin-user.model';
import { AdminUsersStore } from './admin-users.store';

/**
 * Minimal admin user-management table (spec: user-administration). Lists
 * every user with active/role columns and controls to toggle active status
 * and change global role, delegating to {@link AdminUsersStore}. NOT yet
 * wired into `app.routes.ts`/app shell — a standalone piece meant to be
 * mounted by a future admin-shell route (out of scope for this slice, same
 * disclosed gap pattern as `features/board`).
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  template: `
    <div class="admin-users">
      @if (error(); as message) {
        <p data-testid="admin-users-error" class="admin-users-error">{{ message }}</p>
      }
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          @for (user of users(); track user.id) {
            <tr [attr.data-testid]="'user-row-' + user.id">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td data-testid="user-role">{{ user.role }}</td>
              <td data-testid="user-active">{{ user.active ? 'Sí' : 'No' }}</td>
              <td>
                <button
                  type="button"
                  data-testid="toggle-status"
                  (click)="toggleStatus(user)"
                >
                  {{ user.active ? 'Desactivar' : 'Activar' }}
                </button>
                <select
                  data-testid="role-select"
                  [value]="user.role"
                  (change)="onRoleChange(user, $event)"
                >
                  <option value="MIEMBRO_EQUIPO">Miembro del equipo</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                </select>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminUsersComponent implements OnInit {
  private readonly store = inject(AdminUsersStore);

  readonly users = this.store.users;
  readonly error = this.store.error;

  ngOnInit(): void {
    this.store.load();
  }

  toggleStatus(user: AdminUser): void {
    this.store.setStatus(user.id, !user.active);
  }

  onRoleChange(user: AdminUser, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as GlobalRole;
    if (role !== user.role) {
      this.store.changeRole(user.id, role);
    }
  }
}
