import { Injectable, inject, signal } from '@angular/core';

import { AiSubtasksApiService } from './ai-subtasks.api';
import { AiProvider, GenerateSubtasksRequest, SubtaskDraft } from './ai-subtasks.model';

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

  reset(): void {
    this.generated.set(null);
    this.generatedBy.set(null);
    this.model.set(null);
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
