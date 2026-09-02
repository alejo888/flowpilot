import { Injectable, inject, signal } from '@angular/core';

import { AiCriteriaApiService } from './ai-criteria.api';
import { AiProvider } from './board.model';

/** Client-side cap on a criteria list — mirrors the backend schema `maxItems: 8`. */
export const MAX_CRITERIA = 8;

/**
 * Append-only union merge (design D6): the item's existing criteria come first,
 * the AI suggestions are appended, blank suggestions are dropped, duplicates are
 * removed by trimmed string (first occurrence wins) and the result is capped at
 * {@link MAX_CRITERIA}. Never a "replace all".
 */
export function mergeCriteria(
  existing: readonly string[],
  suggestions: readonly string[],
  max = MAX_CRITERIA,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const value of [...existing, ...suggestions]) {
    const key = value.trim();
    if (key === '' && !existing.includes(value)) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(value);
    if (merged.length >= max) {
      break;
    }
  }
  return merged;
}

/**
 * Sibling signals store for AI acceptance-criteria generation (spec:
 * ai-acceptance-criteria-generation, PR 2). Deliberately NOT folded into
 * `BoardStore`: that store's mutating/error signals are shared with
 * drag/move/delete, so an AI failure must not surface as a board-level banner
 * or block unrelated controls.
 *
 * {@link generate} resolves `Promise<boolean>` — `true` only once the server
 * returned a draft — so the panel can keep whatever the user typed on failure.
 * Nothing here is persisted; the panel attaches an accepted draft through the
 * existing `PUT /api/work-items/{id}`.
 */
@Injectable({ providedIn: 'root' })
export class AiCriteriaStore {
  private readonly api = inject(AiCriteriaApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Editable union draft (existing criteria first, suggestions appended). `null` = no draft on screen. */
  readonly draft = signal<string[] | null>(null);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);

  generate(projectId: number, workItemId: number, existing: string[]): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);

    return new Promise((resolve) =>
      this.api.generate(projectId, workItemId).subscribe({
        next: (response) => {
          this.draft.set(mergeCriteria(existing, response.criteria));
          this.generatedBy.set(response.generatedBy);
          this.model.set(response.model);
          this.loading.set(false);
          resolve(true);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.error.set(message(err, 'No se pudieron generar los criterios de aceptación'));
          resolve(false);
        },
      }),
    );
  }

  setDraft(next: string[]): void {
    this.draft.set(next);
  }

  /** Discards the on-screen suggestions. Leaves the item's saved criteria untouched. */
  discard(): void {
    this.draft.set(null);
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
