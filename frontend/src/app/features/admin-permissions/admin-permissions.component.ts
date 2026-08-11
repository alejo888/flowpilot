import { Component, OnInit, inject } from '@angular/core';

import { Permission, ProjectRole } from './role-permission.model';
import { RolePermissionsStore } from './role-permissions.store';

/**
 * Admin-only 6x9 permission-matrix grid (spec: role-permissions). Renders a
 * checkbox per (role, permission) cell, delegates dirty-tracking and the
 * explicit bulk save to {@link RolePermissionsStore}, and shows a
 * reload-and-warn dialog on a 409 (stale `expectedUpdatedAt`) instead of
 * silently discarding the caller's edits. NOT yet wired into
 * `app.routes.ts`/app shell — same disclosed-gap pattern as
 * `features/board` and `features/admin-users`.
 */
@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  template: `
    <div class="admin-permissions">
      @if (error(); as message) {
        <p data-testid="admin-permissions-error" class="admin-permissions-error">{{ message }}</p>
      }

      @if (conflict()) {
        <div data-testid="conflict-dialog" class="conflict-dialog">
          <p>
            La matriz de permisos fue modificada por otro administrador desde que la cargaste.
            Tus cambios locales se perderán si recargas.
          </p>
          <button type="button" data-testid="conflict-reload" (click)="onReload()">
            Recargar
          </button>
        </div>
      }

      <table>
        <thead>
          <tr>
            <th>Rol</th>
            @for (permission of permissions(); track permission.key) {
              <th [title]="permission.description">{{ permission.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (role of roles(); track role) {
            <tr>
              <td>{{ role }}</td>
              @for (permission of permissions(); track permission.key) {
                <td>
                  <input
                    type="checkbox"
                    [attr.data-testid]="'cell-' + role + '-' + permission.key"
                    [class.dirty]="isDirty(role, permission.key)"
                    [checked]="isGranted(role, permission.key)"
                    (click)="onToggle(role, permission.key)"
                  />
                </td>
              }
            </tr>
          }
        </tbody>
      </table>

      <button
        type="button"
        data-testid="save-button"
        [disabled]="!hasDirtyChanges() || saving()"
        (click)="onSave()"
      >
        Guardar
      </button>
    </div>
  `,
})
export class AdminPermissionsComponent implements OnInit {
  private readonly store = inject(RolePermissionsStore);

  readonly roles = this.store.roles;
  readonly permissions = this.store.permissions;
  readonly error = this.store.error;
  readonly conflict = this.store.conflict;
  readonly saving = this.store.saving;
  readonly hasDirtyChanges = this.store.hasDirtyChanges;

  ngOnInit(): void {
    this.store.load();
  }

  isGranted(role: ProjectRole, permission: Permission): boolean {
    return this.store.isGranted(role, permission);
  }

  isDirty(role: ProjectRole, permission: Permission): boolean {
    return this.store.isDirty(role, permission);
  }

  onToggle(role: ProjectRole, permission: Permission): void {
    this.store.toggle(role, permission);
  }

  onSave(): void {
    this.store.save();
  }

  onReload(): void {
    this.store.reloadAfterConflict();
  }
}
