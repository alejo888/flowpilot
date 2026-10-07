import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { LatestRequest } from '../../core/api/latest-request';
import { problemDetail } from '../../core/api/problem-detail';
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

  /** Invalidated by every generate() and reset(); a response only lands while it is the latest. */
  private readonly generation = new LatestRequest(this.loading, this.error);
  /**
   * Invalidated by every confirm() and restart(); a confirm response only lands while it is the latest.
   * A dropped confirm is not cancelled: the non-idempotent POST runs to completion unobserved.
   */
  private readonly confirmation = new LatestRequest(this.submitting, this.error, { cancelOnDrop: false });

  /** Resolves `false` without a request while a confirm is in flight (its success would drop this generate). */
  generate(description: string): Promise<boolean> {
    if (this.submitting()) {
      return Promise.resolve(false);
    }
    this.clearErrors();
    return this.generation.run(this.api.generateDraft({ description }), {
      onSuccess: (response) => {
        this.draft.set(response);
        this.generatedBy.set(response.generatedBy);
        this.model.set(response.model);
      },
      fallback: 'No se pudo generar la propuesta de proyecto',
    });
  }

  /** Resolves `false` without a request while a generate is in flight, so its success never clears a newer draft. */
  confirm(request: ProjectWithBacklogRequest): Promise<boolean> {
    if (this.loading()) {
      return Promise.resolve(false);
    }
    this.clearErrors();
    this.createdProjectId.set(null);
    return this.confirmation.run(this.api.createProjectWithBacklog(request), {
      onSuccess: (project) => {
        this.clearDraft();
        this.createdProjectId.set(project.id);
      },
      onError: (err) => {
        if ((err as HttpErrorResponse)?.status === 409) {
          this.codeError.set(problemDetail(err, 'Ya existe un proyecto con ese código'));
        } else {
          this.error.set(problemDetail(err, 'No se pudo crear el proyecto'));
          this.fieldErrors.set((err as HttpErrorResponse)?.error?.errors ?? {});
        }
      },
    });
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
    this.confirmation.invalidate();
    this.createdProjectId.set(null);
    this.clearDraft();
  }

  private clearDraft(): void {
    this.generation.invalidate();
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
