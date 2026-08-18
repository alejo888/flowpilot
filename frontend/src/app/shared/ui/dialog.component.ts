import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ElementRef, HostListener, inject, input, output } from '@angular/core';

/**
 * FlowPilot true modal overlay — full-viewport backdrop with a centered,
 * focus-trapped panel (spec: ui-modal; design D3). The host element IS the
 * backdrop (`position: fixed; inset: 0`); the projected content renders
 * inside `.fp-dialog__panel`, which carries the `role="dialog"`/`aria-*`
 * semantics (previously placed directly on the host by consumers — moved
 * here because the host's new role is the backdrop container). Consumers
 * pass `label`/`describedById` (element IDs they render inside the
 * projected content) instead of setting `role`/`aria-*` attributes
 * themselves. `data-testid` remains a plain static host attribute, so
 * existing consumer specs keep querying the same selector.
 *
 * Focus trapping uses Angular CDK's `cdkTrapFocus`/`cdkTrapFocusAutoCapture`
 * (`@angular/cdk/a11y`, already a dependency via drag-drop) rather than the
 * native `<dialog>`/`showModal()` API: jsdom (this repo's Vitest test env)
 * does not implement `HTMLDialogElement.showModal`, so CDK keeps the whole
 * suite runnable without a polyfill or shim.
 */
@Component({
  selector: 'fp-dialog',
  standalone: true,
  imports: [CdkTrapFocus],
  template: `
    <div
      class="fp-dialog__panel"
      cdkTrapFocus
      cdkTrapFocusAutoCapture
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="label()"
      [attr.aria-describedby]="describedById()"
    >
      <ng-content></ng-content>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(29, 26, 23, 0.45);
      padding: var(--fp-space-4);
      z-index: 100;
    }

    .fp-dialog__panel {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      align-items: flex-start;
      background: var(--fp-surface);
      border: 1px solid var(--fp-warning);
      border-radius: var(--fp-radius-md);
      box-shadow: var(--fp-shadow-sm);
      padding: var(--fp-space-6);
      max-width: min(90vw, 480px);
    }
  `,
})
export class FpDialogComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Element id rendered inside the projected content → `aria-labelledby`. */
  readonly label = input<string | undefined>(undefined);
  /** Element id rendered inside the projected content → `aria-describedby`. */
  readonly describedById = input<string | undefined>(undefined);
  /** Fired on Escape or a click directly on the backdrop (not the panel). */
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  @HostListener('click', ['$event'])
  onBackdropClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) {
      this.closed.emit();
    }
  }
}
