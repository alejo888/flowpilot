import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AuthStore } from '../../core/auth/auth.store';
import { RolePermissionsApiService } from './role-permissions-api.service';
import {
  Permission,
  ProjectRole,
  RolePermissionCatalogEntry,
  RolePermissionGrant,
  gridKey,
} from './role-permission.model';

/**
 * Signals-based admin-permissions state (design D6 — signals + injectable
 * services, no NgRx; mirrors `features/admin-users/admin-users.store.ts`).
 * Holds a working copy of the 6x10 grid distinct from the last-loaded
 * baseline so individual cells can be dirty-tracked before an explicit bulk
 * save (spec: role-permissions — "the admin grid uses an explicit Save
 * button, so bulk PUT is the only editing shape").
 *
 * <p>On a 409 (stale {@code expectedUpdatedAt}), local edits and the dirty
 * set are deliberately preserved — {@link #conflict} flips true so the
 * component can show a reload-and-warn dialog, and only an explicit {@link
 * #reloadAfterConflict} call discards the in-progress edit and re-fetches
 * the latest matrix.
 */
@Injectable({ providedIn: 'root' })
export class RolePermissionsStore {
  private readonly api = inject(RolePermissionsApiService);
  private readonly auth = inject(AuthStore, { optional: true });

  private readonly rolesSignal = signal<ProjectRole[]>([]);
  private readonly permissionsSignal = signal<RolePermissionCatalogEntry[]>([]);
  private readonly updatedAtSignal = signal<string | null>(null);
  private readonly baselineSignal = signal<Map<string, boolean>>(new Map());
  private readonly workingSignal = signal<Map<string, boolean>>(new Map());
  private readonly errorSignal = signal<string | null>(null);
  private readonly conflictSignal = signal(false);
  private readonly savingSignal = signal(false);

  readonly roles = this.rolesSignal.asReadonly();
  readonly permissions = this.permissionsSignal.asReadonly();
  readonly updatedAt = this.updatedAtSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly conflict = this.conflictSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();

  readonly hasDirtyChanges = computed(() => {
    const baseline = this.baselineSignal();
    const working = this.workingSignal();
    for (const [key, granted] of working) {
      if (baseline.get(key) !== granted) {
        return true;
      }
    }
    return false;
  });

  constructor() {
    effect(() => {
      if (this.auth && !this.auth.isAuthenticated()) {
        this.reset();
      }
    });
  }

  /** Clears all state back to its initial empty shape (e.g. on logout). */
  reset(): void {
    this.rolesSignal.set([]);
    this.permissionsSignal.set([]);
    this.updatedAtSignal.set(null);
    this.baselineSignal.set(new Map());
    this.workingSignal.set(new Map());
    this.errorSignal.set(null);
    this.conflictSignal.set(false);
    this.savingSignal.set(false);
  }

  load(): void {
    this.errorSignal.set(null);
    this.conflictSignal.set(false);
    this.api.getMatrix().subscribe({
      next: (response) => {
        this.rolesSignal.set(response.roles);
        this.permissionsSignal.set(response.permissions);
        this.updatedAtSignal.set(response.updatedAt);
        const map = toMap(response.grants);
        this.baselineSignal.set(map);
        this.workingSignal.set(new Map(map));
      },
      error: (err: unknown) => this.errorSignal.set(errorMessage(err)),
    });
  }

  isGranted(role: ProjectRole, permission: Permission): boolean {
    return this.workingSignal().get(gridKey(role, permission)) ?? false;
  }

  isDirty(role: ProjectRole, permission: Permission): boolean {
    const key = gridKey(role, permission);
    return this.baselineSignal().get(key) !== this.workingSignal().get(key);
  }

  toggle(role: ProjectRole, permission: Permission): void {
    const key = gridKey(role, permission);
    const next = new Map(this.workingSignal());
    next.set(key, !next.get(key));
    this.workingSignal.set(next);
  }

  save(): void {
    this.errorSignal.set(null);
    this.conflictSignal.set(false);
    this.savingSignal.set(true);

    const grants: RolePermissionGrant[] = [];
    for (const [key, granted] of this.workingSignal()) {
      const [role, permission] = key.split(':') as [ProjectRole, Permission];
      grants.push({ role, permission, granted });
    }

    this.api
      .replaceAll({ grants, expectedUpdatedAt: this.updatedAtSignal() })
      .subscribe({
        next: (response) => {
          this.savingSignal.set(false);
          this.rolesSignal.set(response.roles);
          this.permissionsSignal.set(response.permissions);
          this.updatedAtSignal.set(response.updatedAt);
          const map = toMap(response.grants);
          this.baselineSignal.set(map);
          this.workingSignal.set(new Map(map));
        },
        error: (err: unknown) => {
          this.savingSignal.set(false);
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.conflictSignal.set(true);
          } else {
            this.errorSignal.set(errorMessage(err));
          }
        },
      });
  }

  /** Discards in-progress local edits and re-fetches the latest matrix. */
  reloadAfterConflict(): void {
    this.load();
  }
}

function toMap(grants: RolePermissionGrant[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const grant of grants) {
    map.set(gridKey(grant.role, grant.permission), grant.granted);
  }
  return map;
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as { detail?: string } | null)?.detail;
    return detail ?? err.message ?? 'Request failed';
  }
  return err instanceof Error ? err.message : 'Request failed';
}
