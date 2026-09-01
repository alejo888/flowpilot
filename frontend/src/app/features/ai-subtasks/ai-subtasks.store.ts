import { Injectable, inject, signal } from '@angular/core';

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
 * The confirm step (column/sprint pickers + transactional batch create) lands
 * in PR 3b; this store only covers generation and draft provenance.
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

  generate(projectId: number, request: GenerateSubtasksRequest): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    return new Promise((resolve) =>
      this.api.generateSubtasks(projectId, request).subscribe({
        next: (response) => {
          this.generated.set(response.subtasks.map((s) => ({ ...s })));
          this.generatedBy.set(response.generatedBy);
          this.model.set(response.model);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(message(err, 'No se pudieron generar las subtareas'));
          resolve(false);
        },
      }),
    );
  }

  /**
   * Turn the edited drafts into real work items through the transactional
   * batch endpoint. Resolves `true` only once the server returned 201, at
   * which point the generated state is cleared (the component then navigates
   * back to the board). On failure nothing is cleared — the component keeps
   * the drafts and the column/sprint selections.
   */
  confirm(projectId: number, request: WorkItemBatchCreateRequest): Promise<boolean> {
    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    return new Promise((resolve) =>
      this.api.createBatch(projectId, request).subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set('Subtareas creadas.');
          this.reset();
          resolve(true);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(message(err, 'No se pudieron crear las subtareas'));
          resolve(false);
        },
      }),
    );
  }

  reset(): void {
    this.generated.set(null);
    this.generatedBy.set(null);
    this.model.set(null);
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
