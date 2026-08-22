import { Component, OnInit, inject } from '@angular/core';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { Permission, ProjectRole } from './role-permission.model';
import { RolePermissionsStore } from './role-permissions.store';

/**
 * Admin-only 6x9 permission-matrix grid (spec: role-permissions). Renders a
 * checkbox per (role, permission) cell, delegates dirty-tracking and the
 * explicit bulk save to {@link RolePermissionsStore}, and shows a
 * reload-and-warn dialog on a 409 (stale `expectedUpdatedAt`) instead of
 * silently discarding the caller's edits. NOT yet wired into
 * `app.routes.ts`/app shell — same disclosed-gap pattern as
 * `features/board` and `features/admin-users`. Visual layer uses the
 * FlowPilot shared/ui kit (fp-card/fp-button) — behavior is unchanged from
 * the raw-HTML version this replaces.
 */
@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent],
  template: `
    <div class="admin-permissions">
      <h1 class="admin-permissions-title">Permisos por rol</h1>

      @if (error(); as message) {
        <p data-testid="admin-permissions-error" class="admin-permissions-error">{{ message }}</p>
      }

      @if (conflict()) {
        <fp-card data-testid="conflict-dialog" class="conflict-dialog">
          <p class="conflict-dialog-text">
            La matriz de permisos fue modificada por otro administrador desde que la cargaste.
            Tus cambios locales se perderán si recargas.
          </p>
          <fp-button variant="secondary" icon="refresh" testId="conflict-reload" (click)="onReload()">
            Recargar
          </fp-button>
        </fp-card>
      }

      <fp-card class="matrix-card">
        <table class="matrix-table">
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
                <td class="matrix-role">{{ role }}</td>
                @for (permission of permissions(); track permission.key) {
                  <td class="matrix-cell">
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
      </fp-card>

      <fp-button icon="save" testId="save-button" [disabled]="!hasDirtyChanges() || saving()" (click)="onSave()">
        Guardar
      </fp-button>
    </div>
  `,
  styles: `
    .admin-permissions {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      padding: var(--fp-space-8);
      align-items: flex-start;
    }

    .admin-permissions-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .admin-permissions-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .conflict-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      align-items: flex-start;
      border-color: var(--fp-warning);
    }

    .conflict-dialog-text {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
    }

    .matrix-card {
      width: 100%;
      overflow-x: auto;
    }

    .matrix-table {
      border-collapse: collapse;
      font-family: var(--fp-font-body);
      color: var(--fp-text);
    }

    .matrix-table th {
      text-align: left;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted);
      padding: var(--fp-space-2) var(--fp-space-3);
      border-bottom: 1px solid var(--fp-border);
    }

    .matrix-role {
      font-weight: 600;
      padding: var(--fp-space-2) var(--fp-space-3);
      border-bottom: 1px solid var(--fp-border);
      white-space: nowrap;
    }

    .matrix-cell {
      text-align: center;
      padding: var(--fp-space-2) var(--fp-space-3);
      border-bottom: 1px solid var(--fp-border);
    }

    .matrix-cell input[type='checkbox'] {
      width: 16px;
      height: 16px;
      accent-color: var(--fp-accent);
    }

    .matrix-cell input.dirty {
      outline: 2px solid var(--fp-warning);
      outline-offset: 2px;
    }
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
