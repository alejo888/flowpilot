import { Injectable, inject, signal } from '@angular/core';

import { AiCriteriaApiService } from './ai-criteria.api';
import { AiProvider } from './board.model';

/** Client-side cap on a criteria list — mirrors the backend schema `maxItems: 8`. */
export const MAX_CRITERIA = 8;

/** Result of an append-only criteria merge: the capped list plus the suggestions the cap dropped. */
export interface CriteriaMergeResult {
  merged: string[];
  /** Real suggestions (non-blank, not duplicates) that did not fit under the cap, in suggestion order. */
  overflow: string[];
}

/**
 * Append-only union merge (design D6): the item's existing criteria come first,
 * the AI suggestions are appended, blank suggestions are dropped, duplicates are
 * removed by trimmed string (first occurrence wins) and the result is capped at
 * {@link MAX_CRITERIA}. Never a "replace all". Also reports which suggestions were
 * dropped purely because of the cap (not blanks, not duplicates) so the UI can
 * inform the user; this is the single source of truth for the merge rules.
 */
export function mergeCriteriaWithOverflow(
  existing: readonly string[],
  suggestions: readonly string[],
  max = MAX_CRITERIA,
): CriteriaMergeResult {
  const merged: string[] = [];
  const overflow: string[] = [];
  const seen = new Set<string>();
  const entries = [
    ...existing.map((value) => ({ value, suggested: false })),
    ...suggestions.map((value) => ({ value, suggested: true })),
  ];
  for (const { value, suggested } of entries) {
    const key = value.trim();
    if (key === '' && !existing.includes(value)) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (merged.length >= max) {
      if (suggested) {
        overflow.push(value);
      }
      continue;
    }
    merged.push(value);
  }
  return { merged, overflow };
}

/** Same merge as {@link mergeCriteriaWithOverflow}, returning only the capped list. */
export function mergeCriteria(
  existing: readonly string[],
  suggestions: readonly string[],
  max = MAX_CRITERIA,
): string[] {
  return mergeCriteriaWithOverflow(existing, suggestions, max).merged;
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
  /** Suggestions that did not fit under the 8-item cap when the draft was seeded. */
  readonly overflow = signal<string[]>([]);
  readonly generatedBy = signal<AiProvider | null>(null);
  readonly model = signal<string | null>(null);

  generate(projectId: number, workItemId: number, existing: string[]): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);

    return new Promise((resolve) =>
      this.api.generate(projectId, workItemId).subscribe({
        next: (response) => {
          const result = mergeCriteriaWithOverflow(existing, response.criteria);
          this.draft.set(result.merged);
          this.overflow.set(result.overflow);
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
    this.overflow.set([]);
  }
}

function message(err: unknown, fallback: string): string {
  return (err as { error?: { detail?: string } })?.error?.detail ?? fallback;
}
