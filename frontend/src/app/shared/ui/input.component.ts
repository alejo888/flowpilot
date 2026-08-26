import { Component, input, output } from '@angular/core';

/**
 * FlowPilot text input: label + native input + optional error message.
 * Matches the plain `value`/`(input)` signal pattern already used by
 * `LoginComponent` (no `ControlValueAccessor` — nothing in the codebase
 * needs reactive-forms integration yet, so this stays as light as the
 * existing call site).
 */
@Component({
  selector: 'fp-input',
  standalone: true,
  template: `
    <label class="fp-input">
      <span class="fp-input__label">{{ label() }}</span>
      <input
        class="fp-input__control"
        [class.fp-input__control--invalid]="!!error()"
        [type]="type()"
        [value]="value()"
        [required]="required()"
        [attr.data-testid]="testId()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-describedby]="error() ? errorId : null"
        [attr.aria-invalid]="error() ? true : null"
        (input)="onInput($event)"
      />
      @if (error(); as message) {
        <span [id]="errorId" class="fp-input__error">{{ message }}</span>
      }
    </label>
  `,
  styles: `
    .fp-input {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      font-family: var(--fp-font-body);
    }

    .fp-input__label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fp-text-muted);
    }

    .fp-input__control {
      font-family: var(--fp-font-body);
      font-size: 1rem;
      color: var(--fp-text);
      background: var(--fp-surface);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      padding: var(--fp-space-2) var(--fp-space-3);
    }

    .fp-input__control:focus-visible {
      outline: 2px solid var(--fp-focus);
      outline-offset: 1px;
      border-color: var(--fp-focus);
    }

    .fp-input__control--invalid {
      border-color: var(--fp-danger);
    }

    .fp-input__error {
      font-size: 0.8125rem;
      color: var(--fp-danger);
    }
  `,
})
export class FpInputComponent {
  private static nextId = 0;

  readonly label = input('');
  readonly type = input('text');
  readonly value = input('');
  readonly required = input(false);
  readonly error = input<string | null>(null);
  readonly testId = input<string | undefined>(undefined);
  readonly autocomplete = input<string | undefined>(undefined);

  /** Unique per instance, so multiple `fp-input`s on one page never collide. */
  readonly errorId = `fp-input-error-${FpInputComponent.nextId++}`;

  readonly valueChange = output<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
