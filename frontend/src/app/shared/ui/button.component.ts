import { Component, input } from '@angular/core';

/**
 * FlowPilot button. Consumes only `--fp-*` design tokens (see
 * `frontend/src/styles.scss`) — no hardcoded colors. Variants: primary
 * (accent-filled, default), secondary (bordered), danger (destructive
 * actions). Renders a native `<button>` so consumers can rely on standard
 * `disabled`/`type` semantics and existing `data-testid` query patterns.
 */
@Component({
  selector: 'fp-button',
  standalone: true,
  template: `
    <button
      class="fp-button"
      [class.fp-button--secondary]="variant() === 'secondary'"
      [class.fp-button--danger]="variant() === 'danger'"
      [type]="type()"
      [disabled]="disabled()"
      [attr.data-testid]="testId()"
    >
      <ng-content></ng-content>
    </button>
  `,
  styles: `
    .fp-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--fp-space-2);
      padding: var(--fp-space-2) var(--fp-space-4);
      border-radius: var(--fp-radius-sm);
      border: 1px solid transparent;
      background: var(--fp-accent);
      color: var(--fp-accent-contrast);
      font-family: var(--fp-font-body);
      font-weight: 600;
      font-size: 0.9375rem;
      line-height: 1.25;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        opacity 0.15s ease;
    }

    .fp-button:hover:not(:disabled) {
      background: var(--fp-accent-hover);
    }

    .fp-button:focus-visible {
      outline: 2px solid var(--fp-focus);
      outline-offset: 2px;
    }

    .fp-button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .fp-button--secondary {
      background: var(--fp-surface);
      color: var(--fp-text);
      border-color: var(--fp-border);
    }

    .fp-button--secondary:hover:not(:disabled) {
      border-color: var(--fp-accent);
      color: var(--fp-accent);
    }

    .fp-button--danger {
      background: var(--fp-danger);
      color: var(--fp-accent-contrast);
    }

    .fp-button--danger:hover:not(:disabled) {
      opacity: 0.9;
    }
  `,
})
export class FpButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'danger'>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly testId = input<string | undefined>(undefined);
}
