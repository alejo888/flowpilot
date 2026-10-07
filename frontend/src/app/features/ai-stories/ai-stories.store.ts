import { Injectable, inject, signal } from '@angular/core';

import { LatestRequest } from '../../core/api/latest-request';
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
 *
 * The store is root-scoped, so the screen calls {@link reset} on entry; a
 * generate or confirm response that lands after that reset is dropped instead
 * of leaking a draft, message or flag into another project or visit.
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

  /** Invalidated by every generate() and reset(); a response only lands while it is the latest. */
  private readonly generation = new LatestRequest(this.loading, this.error);
  /**
   * Invalidated by every confirm() and reset(); a confirm response only lands while it is the latest.
   * A dropped confirm is not cancelled: the non-idempotent POST runs to completion unobserved.
   */
  private readonly confirmation = new LatestRequest(this.submitting, this.error, { cancelOnDrop: false });

  /** Resolves `false` without a request while a confirm is in flight (they share draft and messages). */
  generate(projectId: number, requirement: string): Promise<boolean> {
    if (this.submitting()) {
      return Promise.resolve(false);
    }
    this.success.set(null);
    return this.generation.run(this.api.generateUserStory(projectId, { requirement }), {
      onSuccess: (response) => {
        this.draft.set(response.userStory);
        this.criteria.set([...response.acceptanceCriteria]);
        this.generatedBy.set(response.generatedBy);
        this.model.set(response.model);
      },
      fallback: 'No se pudo generar la historia de usuario',
    });
  }

  /** Resolves `false` without a request while a generate is in flight, so its success never clears a newer draft. */
  confirm(projectId: number, payload: ConfirmUserStoryPayload): Promise<boolean> {
    if (this.loading()) {
      return Promise.resolve(false);
    }
    this.success.set(null);
    const request = this.board.createWorkItem(projectId, {
      title: payload.title,
      description: payload.description,
      acceptanceCriteria: payload.acceptanceCriteria,
      aiGenerated: true,
      aiModel: this.model(),
    });
    return this.confirmation.run(request, {
      onSuccess: () => {
        this.success.set('Tarea creada a partir de la historia generada.');
        this.clearDraft();
      },
      fallback: 'No se pudo crear la tarea',
    });
  }

  /** Clears draft, flags and messages and invalidates any in-flight generate or confirm, e.g. on screen entry. */
  reset(): void {
    this.generation.invalidate();
    this.confirmation.invalidate();
    this.error.set(null);
    this.success.set(null);
    this.clearDraft();
  }

  private clearDraft(): void {
    this.draft.set(null);
    this.criteria.set([]);
    this.generatedBy.set(null);
    this.model.set(null);
  }
}
