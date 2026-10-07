import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { CONFIRM_TIMEOUT_MS, LatestRequest } from '../../core/api/latest-request';
import { problemDetail } from '../../core/api/problem-detail';
import { AiProjectsApiService } from './ai-projects.api';
import { AiProvider, ProjectDraftResponse, ProjectWithBacklogRequest } from './ai-projects.model';

/**
 * Shown when a confirm POST outlives {@link CONFIRM_TIMEOUT_MS}: it may still have succeeded
 * server-side, so the user is told to check before retrying instead of creating duplicates.
 */
const CONFIRM_TIMEOUT_MESSAGE =
  'La operación está tardando demasiado. Es posible que se haya completado: revisa la lista de proyectos antes de volver a intentarlo.';

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
   * Superseded only by a newer confirm() (blocked while one is in flight); neither reset() nor
   * restart() drops it, so the non-idempotent POST's outcome always lands — unless it outlives
   * CONFIRM_TIMEOUT_MS, when it is abandoned with a check-before-retrying message so a hung POST
   * cannot lock the screen.
   */
  private readonly confirmation = new LatestRequest(this.submitting, this.error, {
    cancelOnDrop: false,
    timeout: { ms: CONFIRM_TIMEOUT_MS, message: CONFIRM_TIMEOUT_MESSAGE },
  });

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
   * Clean slate for a fresh visit to the screen (the root-scoped store outlives
   * the component): drops the draft, errors and any in-flight generate. An
   * in-flight confirm is NOT dropped: its non-idempotent POST still lands, so a
   * success still exposes {@link createdProjectId} (and the confirming caller
   * still navigates to the new board) instead of silently creating a project
   * the user would then re-create. `submitting` stays true until it settles.
   */
  restart(): void {
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
