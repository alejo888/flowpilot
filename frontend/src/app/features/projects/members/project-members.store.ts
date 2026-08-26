import { Injectable, computed, inject, signal } from '@angular/core';

import { ProjectMember, ProjectRole } from './project-member.model';
import { ProjectMembersApiService } from './project-members-api.service';
import { UserSummary } from './user-summary.model';
import { UsersApiService } from './users-api.service';

/**
 * Signals-based project member roster state (spec: project-members-ui;
 * design D2). PR1 exposed `members`/`loading`/`error` + `loadMembers`
 * (read-only roster). PR2 adds the user directory (`users`/`loadUsers`) and
 * `addMember` (server-confirmed local append, no optimistic mutation, no
 * full refetch — design D2). `projectId` is always a method parameter, never
 * store state — the store is `providedIn: 'root'` and therefore a singleton
 * across route navigations, so holding `projectId` internally would create a
 * stale-project hazard (design D2, matching `BoardStore.load(projectId)`).
 * Error extraction copies `ProjectsStore`'s module-level `errorMessage`
 * helper, NOT `BoardStore.moveItem`'s dead `err instanceof Error` form.
 */
@Injectable({ providedIn: 'root' })
export class ProjectMembersStore {
  private readonly api = inject(ProjectMembersApiService);
  private readonly usersApi = inject(UsersApiService);

  private readonly membersSignal = signal<ProjectMember[]>([]);
  private readonly usersSignal = signal<UserSummary[]>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly addingSignal = signal<boolean>(false);
  private readonly lastAddedSignal = signal<ProjectMember | null>(null);
  private readonly mutatingUserIdsSignal = signal<ReadonlySet<number>>(new Set());
  private readonly errorSignal = signal<string | null>(null);

  readonly members = this.membersSignal.asReadonly();
  readonly users = this.usersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly adding = this.addingSignal.asReadonly();
  readonly lastAdded = this.lastAddedSignal.asReadonly();
  /**
   * userIds of every row currently being mutated (role change or removal).
   * A `Set`, not a single value: two rows can have requests in flight at
   * once, and a single shared marker would let the first response's cleanup
   * re-enable a second row whose own request is still pending.
   */
  readonly mutatingUserIds = this.mutatingUserIdsSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  isMutating(userId: number): boolean {
    return this.mutatingUserIdsSignal().has(userId);
  }

  /** userIds already on the roster — the picker excludes them (design D2/D3). */
  readonly memberUserIds = computed(() => new Set(this.membersSignal().map((m) => m.userId)));

  loadMembers(projectId: number): void {
    this.errorSignal.set(null);
    this.loadingSignal.set(true);
    // Cleared up front, not just on error: this store is providedIn:'root'
    // (a singleton across route navigations), so leaving the previous
    // project's roster in place — even briefly — risks a row's role-change
    // or remove action firing against this new projectId with a userId that
    // only belonged to the project the caller just navigated away from.
    this.membersSignal.set([]);
    this.api.listMembers(projectId).subscribe({
      next: (members) => {
        this.membersSignal.set(members);
        this.loadingSignal.set(false);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudieron cargar los miembros'));
        this.loadingSignal.set(false);
      },
    });
  }

  loadUsers(): void {
    this.errorSignal.set(null);
    this.usersApi.listUsers().subscribe({
      next: (users) => this.usersSignal.set(users),
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudo cargar la lista de usuarios'));
      },
    });
  }

  addMember(projectId: number, userId: number, role: ProjectRole): void {
    this.errorSignal.set(null);
    this.addingSignal.set(true);
    this.api.addMember(projectId, { userId, role }).subscribe({
      next: (created) => {
        this.membersSignal.set([...this.membersSignal(), created]);
        this.lastAddedSignal.set(created);
        this.addingSignal.set(false);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudo agregar el miembro'));
        this.addingSignal.set(false);
      },
    });
  }

  changeRole(projectId: number, userId: number, role: ProjectRole): Promise<boolean> {
    this.errorSignal.set(null);
    this.setMutating(userId, true);
    return new Promise((resolve) => this.api.changeRole(projectId, userId, role).subscribe({
      next: (updated) => {
        this.membersSignal.set(this.membersSignal().map((m) => (m.userId === userId ? updated : m)));
        this.setMutating(userId, false);
        resolve(true);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudo cambiar el rol'));
        this.setMutating(userId, false);
        resolve(false);
      },
    }));
  }

  removeMember(projectId: number, userId: number): void {
    this.errorSignal.set(null);
    this.setMutating(userId, true);
    this.api.removeMember(projectId, userId).subscribe({
      next: () => {
        this.membersSignal.set(this.membersSignal().filter((m) => m.userId !== userId));
        this.setMutating(userId, false);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudo quitar el miembro'));
        this.setMutating(userId, false);
      },
    });
  }

  private setMutating(userId: number, mutating: boolean): void {
    const next = new Set(this.mutatingUserIdsSignal());
    if (mutating) next.add(userId); else next.delete(userId);
    this.mutatingUserIdsSignal.set(next);
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
