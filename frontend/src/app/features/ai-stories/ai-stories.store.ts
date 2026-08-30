import { Injectable, inject, signal } from '@angular/core';

import { BoardApiService } from '../board/board-api.service';
import { AiStoriesApiService } from './ai-stories.api';
import { AiProvider, UserStoryDraft } from './ai-stories.model';

/** Editable fields the user confirms into a real work item. */
export interface ConfirmUserStoryPayload {
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

/**
 * Signals store for AI user-story generation (spec: ai-user-story-generation).
 * Follows the `backlog`/`board` layout (`loading`/`error`/`success`) plus the
 * generated `draft`, its `criteria`, and the `generatedBy`/`model` provenance.
 *
 * Both {@link generate} and {@link confirm} resolve `Promise<boolean>` — `true`
 * only once the server confirmed — mirroring `CommentsStore` so a caller can
 * keep the user's typed text on failure instead of discarding it. Nothing here
 * touches the component's editable form state.
 */
@Injectable({ providedIn: 'root' })
export class AiStoriesStore {
  private readonly api = inject(AiStoriesApiService);
  private readonly board = inject(BoardApiService);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly draft = signal<UserStoryDraft | null>(null);
  readonly criteria = signal<string[]>([]);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);

  generate(projectId: number, requirement: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    return new Promise((resolve) =>
      this.api.generateUserStory(projectId, { requirement }).subscribe({
        next: (response) => {
          this.draft.set(response.userStory);
          this.criteria.set([...response.acceptanceCriteria]);
          this.generatedBy.set(response.generatedBy);
          this.model.set(response.model);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(message(err, 'No se pudo generar la historia de usuario'));
          resolve(false);
        },
      }),
    );
  }

  confirm(projectId: number, payload: ConfirmUserStoryPayload): Promise<boolean> {
    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);

    return new Promise((resolve) =>
      this.board
        .createWorkItem(projectId, {
          title: payload.title,
          description: payload.description,
          acceptanceCriteria: payload.acceptanceCriteria,
          aiGenerated: true,
          aiModel: this.model(),
        })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.success.set('Tarea creada a partir de la historia generada.');
            this.reset();
            resolve(true);
          },
          error: (err: unknown) => {
            this.submitting.set(false);
            this.error.set(message(err, 'No se pudo crear la tarea'));
            resolve(false);
          },
        }),
    );
  }

  reset(): void {
    this.draft.set(null);
    this.criteria.set([]);
    this.generatedBy.set(null);
    this.model.set(null);
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
