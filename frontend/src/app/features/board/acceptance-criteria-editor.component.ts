import { Component, EventEmitter, Output, input } from '@angular/core';

/**
 * Standalone acceptance-criteria list editor used inside the board work-item
 * detail panel (spec: ai-acceptance-criteria-generation, PR 2). Renders an
 * ordered list of editable rows plus add/remove controls, capped at {@link max}
 * rows. Purely presentational: it never mutates the {@link criteria} input and
 * emits a fresh array through {@link criteriaChange} on every change.
 *
 * Its styles live in this component's own `styles:` array so the board's
 * `anyComponentStyle` budget (`board.component.scss`) is untouched.
 */
@Component({
  selector: 'fp-acceptance-criteria-editor',
  standalone: true,
  template: `
    <div class="ac-editor">
      <p class="ac-editor__label">{{ label() }}</p>
      @if (criteria().length === 0) {
        <p class="ac-editor__empty">Sin criterios de aceptación.</p>
      }
      <ol class="ac-editor__list">
        @for (criterion of criteria(); track $index) {
          <li class="ac-editor__row" data-testid="criteria-row">
            <input
              class="ac-editor__input"
              data-testid="criteria-input"
              type="text"
              [attr.aria-label]="'Criterio ' + ($index + 1)"
              [value]="criterion"
              [disabled]="disabled()"
              (input)="edit($index, $any($event.target).value)"
            />
            <button
              class="ac-editor__remove"
              data-testid="criteria-remove"
              type="button"
              [disabled]="disabled()"
              (click)="remove($index)"
            >
              Quitar
            </button>
          </li>
        }
      </ol>
      <button
        class="ac-editor__add"
        data-testid="criteria-add"
        type="button"
        [disabled]="disabled() || criteria().length >= max()"
        (click)="add()"
      >
        Añadir criterio
      </button>
    </div>
  `,
  styles: `
    .ac-editor {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-2);
    }
    .ac-editor__label {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted, var(--fp-text));
    }
    .ac-editor__empty {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--fp-text-muted, var(--fp-text));
    }
    .ac-editor__list {
      list-style: decimal;
      margin: 0;
      padding-left: var(--fp-space-5);
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-2);
    }
    .ac-editor__row {
      display: flex;
      align-items: center;
      gap: var(--fp-space-2);
    }
    .ac-editor__input {
      flex: 1 1 auto;
      min-width: 0;
      padding: var(--fp-space-2);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
    }
    .ac-editor__remove,
    .ac-editor__add {
      flex: 0 0 auto;
      padding: var(--fp-space-1) var(--fp-space-3);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      background: var(--fp-surface);
      color: var(--fp-text);
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
    }
    .ac-editor__add {
      align-self: flex-start;
    }
    .ac-editor__remove:disabled,
    .ac-editor__add:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class AcceptanceCriteriaEditorComponent {
  readonly criteria = input<string[]>([]);
  readonly disabled = input(false);
  readonly max = input(8);
  readonly label = input('Criterios de aceptación');

  @Output() readonly criteriaChange = new EventEmitter<string[]>();

  add(): void {
    if (this.disabled() || this.criteria().length >= this.max()) {
      return;
    }
    this.criteriaChange.emit([...this.criteria(), '']);
  }

  remove(index: number): void {
    if (this.disabled()) {
      return;
    }
    this.criteriaChange.emit(this.criteria().filter((_, i) => i !== index));
  }

  edit(index: number, value: string): void {
    if (this.disabled()) {
      return;
    }
    this.criteriaChange.emit(this.criteria().map((c, i) => (i === index ? value : c)));
  }
}
