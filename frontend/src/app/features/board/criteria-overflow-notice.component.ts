import { Component, computed, input } from '@angular/core';

import { MAX_CRITERIA } from './ai-criteria.store';

/**
 * Informational notice (never blocking) listing AI-suggested acceptance criteria
 * that will not be added because the item is capped at {@link MAX_CRITERIA}.
 * Renders nothing when everything fits. Shared by the criteria-generation and
 * story-improvement flows; styles are inline so `board.component.scss`'s style
 * budget is untouched.
 */
@Component({
  selector: 'fp-criteria-overflow-notice',
  standalone: true,
  template: `
    @if (overflow().length > 0) {
      <div class="con" role="status" data-testid="criteria-overflow-notice">
        <p class="con__title">{{ headline() }}</p>
        <ul class="con__list">
          @for (criterion of overflow(); track $index) {
            <li data-testid="criteria-overflow-item">{{ criterion }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    .con {
      padding: var(--fp-space-2) var(--fp-space-3);
      border: 1px solid var(--fp-border);
      border-left: 3px solid var(--fp-accent);
      border-radius: var(--fp-radius-sm);
      font-size: 0.8125rem;
    }
    .con__title {
      margin: 0;
      font-weight: 600;
    }
    .con__list {
      margin: var(--fp-space-1) 0 0;
      padding-left: var(--fp-space-5);
      text-decoration: line-through;
    }
  `,
})
export class CriteriaOverflowNoticeComponent {
  /** Suggested criteria that will not fit under the cap. */
  readonly overflow = input<string[]>([]);

  readonly headline = computed(() => {
    const count = this.overflow().length;
    return count === 1
      ? `1 criterio sugerido no cabe (tope ${MAX_CRITERIA}) y no se añadirá`
      : `${count} criterios sugeridos no caben (tope ${MAX_CRITERIA}) y no se añadirán`;
  });
}
