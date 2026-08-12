import { Injectable, inject, signal } from '@angular/core';

import { ProjectMember } from './project-member.model';
import { ProjectMembersApiService } from './project-members-api.service';

/**
 * Signals-based project member roster state (spec: project-members-ui;
 * design D2). PR1 exposes `members`/`loading`/`error` + `loadMembers` only
 * (read-only roster). `projectId` is always a method parameter, never store
 * state — the store is `providedIn: 'root'` and therefore a singleton across
 * route navigations, so holding `projectId` internally would create a
 * stale-project hazard (design D2, matching `BoardStore.load(projectId)`).
 * Error extraction copies `ProjectsStore`'s module-level `errorMessage`
 * helper, NOT `BoardStore.moveItem`'s dead `err instanceof Error` form.
 */
@Injectable({ providedIn: 'root' })
export class ProjectMembersStore {
  private readonly api = inject(ProjectMembersApiService);

  private readonly membersSignal = signal<ProjectMember[]>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly members = this.membersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  loadMembers(projectId: number): void {
    this.errorSignal.set(null);
    this.loadingSignal.set(true);
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
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
