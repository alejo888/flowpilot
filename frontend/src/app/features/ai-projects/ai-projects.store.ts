import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { AiProjectsApiService } from './ai-projects.api';
import { AiProvider, ProjectDraftResponse, ProjectWithBacklogRequest } from './ai-projects.model';

/**
 * Signals store for AI project creation (vision 7.4). Holds the raw draft, the
 * provenance and request status; the editable form state lives in the
 * component (same split as `AiStoriesStore`).
 *
 * {@link generate} and {@link confirm} resolve `Promise<boolean>` — `true` only
 * once the server confirmed — so a caller keeps whatever the user typed on
 * failure. Generation uses a request token: a response that lands after
 * {@link reset} (or after a newer generate) never repopulates state. The store
 * is Router-free; the component navigates using {@link createdProjectId}.
 */
@Injectable({ providedIn: 'root' })
export class AiProjectsStore {
  private readonly api = inject(AiProjectsApiService);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  /** Backend `errors` map (path -> Spanish message) from a 400, empty otherwise. */
  readonly fieldErrors = signal<Record<string, string>>({});
  /** Spanish detail of a 409 (duplicate project code), shown next to the code field. */
  readonly codeError = signal<string | null>(null);
  readonly draft = signal<ProjectDraftResponse | null>(null);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);
  readonly createdProjectId = signal<number | null>(null);

  /** Bumped by every generate() and reset(); a response only lands if it still matches. */
  private generation = 0;
  /** Bumped by restart(); an in-flight confirm only lands if it still matches. */
  private confirmation = 0;

  generate(description: string): Promise<boolean> {
    const token = ++this.generation;
    this.loading.set(true);
    this.clearErrors();

    return new Promise((resolve) =>
      this.api.generateDraft({ description }).subscribe({
        next: (response) => {
          if (token !== this.generation) {
            resolve(false);
            return;
          }
          this.draft.set(response);
          this.generatedBy.set(response.generatedBy);
          this.model.set(response.model);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          if (token !== this.generation) {
            resolve(false);
            return;
          }
          this.loading.set(false);
          this.error.set(detail(err) ?? 'No se pudo generar la propuesta de proyecto');
          resolve(false);
        },
      }),
    );
  }

  confirm(request: ProjectWithBacklogRequest): Promise<boolean> {
    const token = ++this.confirmation;
    this.submitting.set(true);
    this.clearErrors();
    this.createdProjectId.set(null);

    return new Promise((resolve) =>
      this.api.createProjectWithBacklog(request).subscribe({
        next: (project) => {
          if (token !== this.confirmation) {
            resolve(false);
            return;
          }
          this.submitting.set(false);
          this.clearDraft();
          this.createdProjectId.set(project.id);
          resolve(true);
        },
        error: (err: unknown) => {
          if (token !== this.confirmation) {
            resolve(false);
            return;
          }
          this.submitting.set(false);
          const message = detail(err);
          if ((err as HttpErrorResponse)?.status === 409) {
            this.codeError.set(message ?? 'Ya existe un proyecto con ese código');
          } else {
            this.error.set(message ?? 'No se pudo crear el proyecto');
            this.fieldErrors.set((err as HttpErrorResponse)?.error?.errors ?? {});
          }
          resolve(false);
        },
      }),
    );
  }

  /**
   * Drops draft, provenance and errors and invalidates any in-flight generate.
   * A no-op while a confirm is in flight: discarding then would lose the user's
   * edits if the POST fails and would contradict a POST that succeeds.
   */
  reset(): void {
    if (this.submitting()) {
      return;
    }
    this.clearDraft();
  }

  /**
   * Unconditional clean slate for a fresh visit to the screen: also invalidates
   * an in-flight confirm (the root-scoped store outlives the component) so its
   * late result cannot repopulate state.
   */
  restart(): void {
    this.confirmation++;
    this.submitting.set(false);
    this.createdProjectId.set(null);
    this.clearDraft();
  }

  private clearDraft(): void {
    this.generation++;
    this.loading.set(false);
    this.draft.set(null);
    this.generatedBy.set(null);
    this.model.set(null);
    this.clearErrors();
  }

  private clearErrors(): void {
    this.error.set(null);
    this.fieldErrors.set({});
    this.codeError.set(null);
  }
}

function detail(err: unknown): string | undefined {
  return (err as { error?: { detail?: string } })?.error?.detail;
}
