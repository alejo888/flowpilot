import { Component, OnInit, inject } from '@angular/core';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpSelectComponent } from '../../shared/ui/select.component';
import { AdminUser, GlobalRole } from './admin-user.model';
import { AdminUsersStore } from './admin-users.store';

/**
 * Minimal admin user-management table (spec: user-administration). Lists
 * every user with active/role columns and controls to toggle active status
 * and change global role, delegating to {@link AdminUsersStore}. NOT yet
 * wired into `app.routes.ts`/app shell — a standalone piece meant to be
 * mounted by a future admin-shell route (out of scope for this slice, same
 * disclosed gap pattern as `features/board`). Visual layer uses the
 * FlowPilot shared/ui kit (fp-card/fp-badge/fp-button/fp-select) — behavior
 * is unchanged from the raw-HTML version this replaces.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [FpBadgeComponent, FpButtonComponent, FpCardComponent, FpSelectComponent],
  template: `
    <div class="admin-users">
      <h1 class="admin-users-title">Usuarios</h1>
      @if (error(); as message) {
        <p data-testid="admin-users-error" class="admin-users-error">{{ message }}</p>
      }
      <fp-card class="admin-users-card">
        <table class="admin-users-table">
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
                <td data-label="Nombre">{{ user.name }}</td>
                <td data-label="Email">{{ user.email }}</td>
                <td data-label="Rol" data-testid="user-role">{{ user.role }}</td>
                <td data-label="Activo" data-testid="user-active">
                  @if (user.active) {
                    <fp-badge variant="success">Sí</fp-badge>
                  } @else {
                    <fp-badge variant="danger">No</fp-badge>
                  }
                </td>
                <td class="admin-users-actions" data-label="Acciones">
                  <fp-button variant="secondary" testId="toggle-status" (click)="toggleStatus(user)">
                    {{ user.active ? 'Desactivar' : 'Activar' }}
                  </fp-button>
                  <fp-select
                    testId="role-select"
                    [value]="user.role"
                    [options]="roleOptions"
                    (valueChange)="onRoleChange(user, $event)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </fp-card>
    </div>
  `,
  styles: `
    .admin-users {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      padding: var(--fp-space-8);
    }

    .admin-users-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .admin-users-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .admin-users-card {
      overflow-x: auto;
    }

    .admin-users-table {
      width: 100%;
      min-width: 640px;
      border-collapse: collapse;
      font-family: var(--fp-font-body);
      color: var(--fp-text);
    }

    .admin-users-table th {
      text-align: left;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted);
      padding: var(--fp-space-2) var(--fp-space-3);
      border-bottom: 1px solid var(--fp-border);
    }

    .admin-users-table td {
      padding: var(--fp-space-3);
      border-bottom: 1px solid var(--fp-border);
      vertical-align: middle;
    }

    .admin-users-actions {
      display: flex;
      align-items: center;
      gap: var(--fp-space-3);
    }

    // Below this width a 5-column table has no room to breathe even with
    // horizontal scroll — restyle each row as a stacked label:value card
    // instead (data-label supplies the label via ::before).
    @media (max-width: 640px) {
      .admin-users-table {
        min-width: 0;
      }

      .admin-users-table thead {
        display: none;
      }

      .admin-users-table,
      .admin-users-table tbody,
      .admin-users-table tr,
      .admin-users-table td {
        display: block;
        width: 100%;
      }

      .admin-users-table tr {
        border: 1px solid var(--fp-border);
        border-radius: var(--fp-radius-md);
        padding: var(--fp-space-3);
      }

      .admin-users-table tr + tr {
        margin-top: var(--fp-space-3);
      }

      .admin-users-table td {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--fp-space-3);
        padding: var(--fp-space-2) 0;
        border-bottom: none;
      }

      .admin-users-table td::before {
        content: attr(data-label);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--fp-text-muted);
      }

      .admin-users-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .admin-users-actions::before {
        margin-bottom: var(--fp-space-1);
      }
    }
  `,
})
export class AdminUsersComponent implements OnInit {
  private readonly store = inject(AdminUsersStore);

  readonly users = this.store.users;
  readonly error = this.store.error;

  readonly roleOptions: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'MIEMBRO_EQUIPO', label: 'Miembro del equipo' },
    { value: 'ADMINISTRADOR', label: 'Administrador' },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  toggleStatus(user: AdminUser): void {
    this.store.setStatus(user.id, !user.active);
  }

  onRoleChange(user: AdminUser, role: string): void {
    const newRole = role as GlobalRole;
    if (newRole !== user.role) {
      this.store.changeRole(user.id, newRole);
    }
  }
}
