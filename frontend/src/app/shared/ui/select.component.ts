import { Component, input, output } from '@angular/core';

/**
 * FlowPilot select: label + native `<select>` with an optional placeholder
 * option. Mirrors `fp-input`'s plain `value`/`valueChange` signal pattern
 * (no `ControlValueAccessor`) so call sites keep driving state with
 * `.set()` in the same style as the rest of the codebase.
 */
@Component({
  selector: 'fp-select',
  standalone: true,
  template: `
    <label class="fp-select">
      @if (label()) {
        <span class="fp-select__label">{{ label() }}</span>
      }
      <select
        class="fp-select__control"
        [disabled]="disabled()"
        [attr.data-testid]="testId()"
        (change)="onChange($event)"
      >
        @if (placeholder(); as ph) {
          <option value="" [selected]="value() === ''">{{ ph }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()">
            {{ option.label }}
          </option>
        }
      </select>
    </label>
  `,
  styles: `
    .fp-select {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      font-family: var(--fp-font-body);
    }

    .fp-select__label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fp-text-muted);
    }

    .fp-select__control {
      font-family: var(--fp-font-body);
      font-size: 1rem;
      color: var(--fp-text);
      background-color: var(--fp-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b625b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right var(--fp-space-3) center;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-sm);
      padding: var(--fp-space-2) var(--fp-space-8) var(--fp-space-2) var(--fp-space-3);
    }

    .fp-select__control:focus-visible {
      outline: 2px solid var(--fp-focus);
      outline-offset: 1px;
      border-color: var(--fp-focus);
    }

    .fp-select__control:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `,
})
export class FpSelectComponent {
  readonly label = input('');
  readonly placeholder = input<string | null>(null);
  readonly options = input<ReadonlyArray<{ value: string; label: string }>>([]);
  readonly value = input('');
  readonly disabled = input(false);
  readonly testId = input<string | undefined>(undefined);

  readonly valueChange = output<string>();

  onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
