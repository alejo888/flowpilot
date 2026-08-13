import { Component } from '@angular/core';

/**
 * FlowPilot inline confirmation dialog — not a real browser `<dialog>`
 * overlay/modal (nothing in this codebase manages focus-trapping or a
 * backdrop yet), just a styled inline block that reuses the card surface
 * treatment with a warning-tinted border, matching the visual weight the
 * raw `.conflict-dialog`/`.self-remove-dialog` blocks already had. Purely
 * presentational; projects arbitrary content (message + action buttons).
 */
@Component({
  selector: 'fp-dialog',
  standalone: true,
  template: `<ng-content></ng-content>`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      align-items: flex-start;
      background: var(--fp-surface);
      border: 1px solid var(--fp-warning);
      border-radius: var(--fp-radius-md);
      box-shadow: var(--fp-shadow-sm);
      padding: var(--fp-space-6);
    }
  `,
})
export class FpDialogComponent {}
