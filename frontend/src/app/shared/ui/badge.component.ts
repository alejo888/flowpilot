import { Component, input } from '@angular/core';

/**
 * FlowPilot status pill. Variants map to the semantic `--fp-*` colors —
 * success/warning/danger/neutral.
 */
@Component({
  selector: 'fp-badge',
  standalone: true,
  template: `
    <span
      class="fp-badge"
      [class.fp-badge--success]="variant() === 'success'"
      [class.fp-badge--warning]="variant() === 'warning'"
      [class.fp-badge--danger]="variant() === 'danger'"
      [class.fp-badge--neutral]="variant() === 'neutral'"
    >
      <ng-content></ng-content>
    </span>
  `,
  styles: `
    .fp-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--fp-space-1) var(--fp-space-2);
      border-radius: var(--fp-radius-lg);
      font-family: var(--fp-font-body);
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.4;
      background: var(--fp-border);
      color: var(--fp-text);
    }

    .fp-badge--success {
      background: color-mix(in srgb, var(--fp-success) 16%, white);
      color: var(--fp-success);
    }

    .fp-badge--warning {
      background: color-mix(in srgb, var(--fp-warning) 16%, white);
      color: var(--fp-warning);
    }

    .fp-badge--danger {
      background: color-mix(in srgb, var(--fp-danger) 16%, white);
      color: var(--fp-danger);
    }

    .fp-badge--neutral {
      background: var(--fp-border);
      color: var(--fp-text-muted);
    }
  `,
})
export class FpBadgeComponent {
  readonly variant = input<'success' | 'warning' | 'danger' | 'neutral'>('neutral');
}
