import { Injectable, inject, signal } from '@angular/core';

import { AiStoryImprovementApiService } from './ai-story-improvement.api';
import { AiProvider } from './board.model';

/** Suggested replacement description plus suggested acceptance criteria. */
export interface StorySuggestion {
  description: string;
  criteria: string[];
}

/**
 * Sibling signals store for AI story improvement (vision 7.7). Kept apart from
 * `BoardStore`/`AiCriteriaStore` so an AI failure never blocks board actions.
 *
 * {@link generate} resolves `Promise<boolean>` — `true` only once the server
 * returned a draft — and a failure never clears an on-screen suggestion or
 * anything the user typed. Nothing here is persisted.
 */
@Injectable({ providedIn: 'root' })
export class AiStoryImprovementStore {
  private readonly api = inject(AiStoryImprovementApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** `null` = no suggestion on screen. */
  readonly suggestion = signal<StorySuggestion | null>(null);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);

  generate(projectId: number, workItemId: number): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);

    return new Promise((resolve) =>
      this.api.improve(projectId, workItemId).subscribe({
        next: (response) => {
          this.suggestion.set({
            description: response.userStory.text,
            criteria: response.acceptanceCriteria,
          });
          this.generatedBy.set(response.generatedBy);
          this.model.set(response.model);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(
            (err as { error?: { detail?: string } })?.error?.detail ?? 'No se pudo mejorar la historia',
          );
          resolve(false);
        },
      }),
    );
  }

  /** Drops the on-screen suggestion only. */
  discard(): void {
    this.suggestion.set(null);
  }

  /** Clears suggestion and error, e.g. when the open work item changes. */
  reset(): void {
    this.suggestion.set(null);
    this.error.set(null);
  }
}
