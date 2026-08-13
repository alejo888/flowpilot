import { Component } from '@angular/core';

/**
 * FlowPilot surface container — border, medium radius, small shadow,
 * comfortable padding. Purely presentational; projects arbitrary content.
 */
@Component({
  selector: 'fp-card',
  standalone: true,
  template: `<ng-content></ng-content>`,
  styles: `
    :host {
      display: block;
      background: var(--fp-surface);
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-md);
      box-shadow: var(--fp-shadow-sm);
      padding: var(--fp-space-6);
    }
  `,
})
export class FpCardComponent {}
