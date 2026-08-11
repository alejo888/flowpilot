import { Injectable, inject, signal } from '@angular/core';

import { Project } from './project.model';
import { ProjectsApiService } from './projects-api.service';

/**
 * Signals-based projects state (spec: projects-ui; design D2, D3). Holds the
 * authenticated user's own project list and exposes `loading` so the
 * "no projects yet" empty state can be distinguished from "still fetching".
 * Error extraction follows {@link AuthStore}'s ProblemDetail `detail`
 * pattern, NOT `AdminUsersStore.errorMessage`'s `instanceof Error` check —
 * `HttpErrorResponse` implements but does not extend `Error`, so that check
 * is dead code for every HTTP failure (design D2).
 */
@Injectable({ providedIn: 'root' })
export class ProjectsStore {
  private readonly api = inject(ProjectsApiService);

  private readonly projectsSignal = signal<Project[]>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly projects = this.projectsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  loadProjects(): void {
    this.errorSignal.set(null);
    this.loadingSignal.set(true);
    this.api.listProjects().subscribe({
      next: (projects) => {
        this.projectsSignal.set(projects);
        this.loadingSignal.set(false);
      },
      error: (err: unknown) => {
        this.errorSignal.set(errorMessage(err, 'No se pudieron cargar los proyectos'));
        this.loadingSignal.set(false);
      },
    });
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
