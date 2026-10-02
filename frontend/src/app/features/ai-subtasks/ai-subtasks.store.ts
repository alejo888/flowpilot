import { Injectable, inject, signal } from '@angular/core';

import { LatestRequest } from '../../core/api/latest-request';
import { AiSubtasksApiService } from './ai-subtasks.api';
import {
  AiProvider,
  GenerateSubtasksRequest,
  SubtaskDraft,
  WorkItemBatchCreateRequest,
} from './ai-subtasks.model';

/**
 * Signals store for AI subtask generation (spec: ai-subtask-generation).
 * Follows the `ai-stories` layout (`loading`/`error`/`success`) plus the
 * generated `subtasks` list and its `generatedBy`/`model` provenance.
 *
 * {@link generate} resolves `Promise<boolean>` — `true` only once the server
 * returned a draft list — mirroring `AiStoriesStore`/`CommentsStore` so the
 * component can keep the user's typed text and edited rows on failure instead
 * of discarding them. Nothing here touches the component's editable form state.
 *
 * {@link confirm} turns the edited drafts into work items through the
 * transactional batch endpoint. Each request is token-guarded: a response that
 * lands after {@link reset} (or after a newer request of the same kind) is
 * dropped instead of repopulating state.
 */
@Injectable({ providedIn: 'root' })
export class AiSubtasksStore {
  private readonly api = inject(AiSubtasksApiService);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly generated = signal<SubtaskDraft[] | null>(null);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);

  private readonly generation = new LatestRequest(this.loading, this.error);
  private readonly confirmation = new LatestRequest(this.submitting, this.error);

  /** Resolves `false` without a request while a confirm is in flight (they share drafts and messages). */
  generate(projectId: number, request: GenerateSubtasksRequest): Promise<boolean> {
    if (this.submitting()) {
      return Promise.resolve(false);
    }
    this.success.set(null);
    return this.generation.run(this.api.generateSubtasks(projectId, request), {
      onSuccess: (response) => {
        this.generated.set(response.subtasks.map((s) => ({ ...s })));
        this.generatedBy.set(response.generatedBy);
        this.model.set(response.model);
      },
      fallback: 'No se pudieron generar las subtareas',
    });
  }

  /**
   * Turn the edited drafts into real work items through the transactional
   * batch endpoint. Resolves `true` only once the server returned 201, at
   * which point the generated state is cleared (the component then navigates
   * back to the board). On failure nothing is cleared — the component keeps
   * the drafts and the column/sprint selections. Resolves `false` without a
   * request while a generate is in flight, so its success never clears a newer draft.
   */
  confirm(projectId: number, request: WorkItemBatchCreateRequest): Promise<boolean> {
    if (this.loading()) {
      return Promise.resolve(false);
    }
    this.success.set(null);
    return this.confirmation.run(this.api.createBatch(projectId, request), {
      onSuccess: () => {
        this.success.set('Subtareas creadas.');
        this.clearDraft();
      },
      fallback: 'No se pudieron crear las subtareas',
    });
  }

  /** Clears draft, flags and messages and invalidates any in-flight generate or confirm. */
  reset(): void {
    this.generation.invalidate();
    this.confirmation.invalidate();
    this.error.set(null);
    this.success.set(null);
    this.clearDraft();
  }

  private clearDraft(): void {
    this.generated.set(null);
    this.generatedBy.set(null);
    this.model.set(null);
  }
}
