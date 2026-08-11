import { Injectable, computed, inject, signal } from '@angular/core';

import { AdminUsersApiService } from './admin-users-api.service';
import { AdminUser, GlobalRole } from './admin-user.model';

/**
 * Signals-based admin-users state (design D6 — signals + injectable
 * services, no NgRx; mirrors `features/board/board.store.ts`). Holds the
 * full user list and exposes {@link activeAdministratorCount} as a UI hint
 * only — the server is the sole authority on the last-Administrador
 * lockout guard (spec: user-administration); a rejected status/role change
 * surfaces the server's error message and leaves state untouched.
 */
@Injectable({ providedIn: 'root' })
export class AdminUsersStore {
  private readonly api = inject(AdminUsersApiService);

  private readonly usersSignal = signal<AdminUser[]>([]);
  private readonly errorSignal = signal<string | null>(null);

  readonly users = this.usersSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly activeAdministratorCount = computed(
    () => this.usersSignal().filter((u) => u.role === 'ADMINISTRADOR' && u.active).length,
  );

  load(): void {
    this.errorSignal.set(null);
    this.api.listUsers().subscribe({
      next: (users) => this.usersSignal.set(users),
      error: (err: unknown) => this.errorSignal.set(errorMessage(err)),
    });
  }

  setStatus(id: number, active: boolean): void {
    this.errorSignal.set(null);
    this.api.setStatus(id, { active }).subscribe({
      next: (updated) => this.replace(updated),
      error: (err: unknown) => this.errorSignal.set(errorMessage(err)),
    });
  }

  changeRole(id: number, role: GlobalRole): void {
    this.errorSignal.set(null);
    this.api.changeRole(id, { role }).subscribe({
      next: (updated) => this.replace(updated),
      error: (err: unknown) => this.errorSignal.set(errorMessage(err)),
    });
  }

  private replace(updated: AdminUser): void {
    this.usersSignal.set(this.usersSignal().map((u) => (u.id === updated.id ? updated : u)));
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}
