import { Component, ElementRef, OnInit, effect, inject, viewChild } from '@angular/core';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { Permission, ProjectRole } from './role-permission.model';
import { RolePermissionsStore } from './role-permissions.store';

/**
 * Admin-only 6x10 permission-matrix grid (spec: role-permissions). Renders a
 * checkbox per (role, permission) cell, delegates dirty-tracking and the
 * explicit bulk save to {@link RolePermissionsStore}, and shows a
 * reload-and-warn dialog on a 409 (stale `expectedUpdatedAt`) instead of
 * silently discarding the caller's edits. Visual layer uses the FlowPilot
 * shared/ui kit (fp-card/fp-button) — behavior is unchanged from the
 * raw-HTML version this replaces.
 */
@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent],
  template: `
    <div class="admin-permissions">
      <h1 class="admin-permissions-title">Permisos por rol</h1>

      @if (error(); as message) {
        <p
          data-testid="admin-permissions-error"
          class="admin-permissions-error"
          role="alert"
          aria-live="assertive"
        >
          {{ message }}
        </p>
      }

      @if (conflict()) {
        <fp-card
          #conflictDialog
          data-testid="conflict-dialog"
          class="conflict-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="conflict-dialog-text"
          tabindex="-1"
        >
          <p id="conflict-dialog-text" class="conflict-dialog-text">
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
          <caption class="matrix-caption">
            Matriz de permisos por rol de proyecto
          </caption>
          <thead>
            <tr>
              <th scope="col">Rol</th>
              @for (permission of permissions(); track permission.key) {
                <th scope="col" [title]="permission.description">{{ permission.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (role of roles(); track role) {
              <tr>
                <th scope="row" class="matrix-role">{{ role }}</th>
                @for (permission of permissions(); track permission.key) {
                  <td class="matrix-cell">
                    <input
                      type="checkbox"
                      [attr.data-testid]="'cell-' + role + '-' + permission.key"
                      [attr.aria-label]="role + ': ' + permission.label"
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

    .matrix-caption {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
  private readonly conflictDialog = viewChild('conflictDialog', { read: ElementRef });

  readonly roles = this.store.roles;
  readonly permissions = this.store.permissions;
  readonly error = this.store.error;
  readonly conflict = this.store.conflict;
  readonly saving = this.store.saving;
  readonly hasDirtyChanges = this.store.hasDirtyChanges;

  constructor() {
    // Moves focus into the conflict alertdialog as soon as it renders, so a
    // screen-reader user is told about the 409 instead of it appearing
    // silently below the fold.
    effect(() => {
      if (this.conflict()) {
        (this.conflictDialog()?.nativeElement as HTMLElement | undefined)?.focus();
      }
    });
  }

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
