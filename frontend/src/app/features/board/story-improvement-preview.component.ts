import { Component, input, output } from '@angular/core';

import { FpButtonComponent } from '../../shared/ui/button.component';

/**
 * Read-only preview of an AI story-improvement suggestion (vision 7.7): the
 * suggested description and criteria, with Apply / Discard actions. Purely
 * presentational; the board panel decides what applying does. Styles are
 * inline so `board.component.scss`'s style budget is untouched.
 */
@Component({
  selector: 'fp-story-improvement-preview',
  standalone: true,
  imports: [FpButtonComponent],
  template: `
    <div class="sip" role="group" aria-label="Historia mejorada sugerida">
      <p class="sip__label">Descripción sugerida</p>
      <p class="sip__text" data-testid="improve-story-description">{{ description() }}</p>
      @if (criteria().length > 0) {
        <p class="sip__label">Criterios sugeridos</p>
        <ul class="sip__list">
          @for (criterion of criteria(); track $index) {
            <li data-testid="improve-story-criterion">{{ criterion }}</li>
          }
        </ul>
      }
      <div class="sip__actions">
        <fp-button type="button" icon="save" testId="improve-story-apply" (click)="apply.emit()">Aplicar</fp-button>
        <fp-button type="button" variant="secondary" icon="close" testId="improve-story-discard" (click)="discard.emit()">Descartar</fp-button>
      </div>
    </div>
  `,
  styles: `
    .sip {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-2);
      padding: var(--fp-space-3);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
    }
    .sip__label {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted, var(--fp-text));
    }
    .sip__text {
      margin: 0;
      white-space: pre-wrap;
    }
    .sip__list {
      margin: 0;
      padding-left: var(--fp-space-5);
    }
    .sip__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--fp-space-2);
    }
  `,
})
export class StoryImprovementPreviewComponent {
  readonly description = input.required<string>();
  readonly criteria = input<string[]>([]);
  readonly apply = output<void>();
  readonly discard = output<void>();
}
