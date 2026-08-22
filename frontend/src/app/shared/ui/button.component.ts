import { Component, input } from '@angular/core';
import { FpIconComponent, FpIconName } from './icon.component';

@Component({
  selector: 'fp-button', standalone: true, imports: [FpIconComponent],
  template: `
    <button class="fp-button" [class.fp-button--secondary]="variant() === 'secondary'" [class.fp-button--danger]="variant() === 'danger'" [type]="type()" [disabled]="disabled()" [attr.data-testid]="testId()" [attr.aria-label]="ariaLabel()">
      @if (icon(); as iconName) { <fp-icon [name]="iconName" /> }
      <ng-content></ng-content>
    </button>
  `,
  styles: `
    .fp-button { display:inline-flex; align-items:center; justify-content:center; gap:var(--fp-space-2); padding:var(--fp-space-2) var(--fp-space-4); border-radius:var(--fp-radius-sm); border:1px solid transparent; background:var(--fp-accent); color:var(--fp-accent-contrast); font-family:var(--fp-font-body); font-weight:600; font-size:.9375rem; line-height:1.25; cursor:pointer; transition:background-color .15s ease,border-color .15s ease,opacity .15s ease; }
    .fp-button .fp-icon { width:1.125rem; height:1.125rem; flex:0 0 1.125rem; fill:currentColor; }
    .fp-button:hover:not(:disabled) { background:var(--fp-accent-hover); }
    .fp-button:focus-visible { outline:2px solid var(--fp-focus); outline-offset:2px; }
    .fp-button:disabled { opacity:.55; cursor:not-allowed; }
    .fp-button--secondary { background:var(--fp-surface); color:var(--fp-text); border-color:var(--fp-border); }
    .fp-button--secondary:hover:not(:disabled) { border-color:var(--fp-accent); color:var(--fp-accent); }
    .fp-button--danger { background:var(--fp-danger); color:var(--fp-accent-contrast); }
    .fp-button--danger:hover:not(:disabled) { opacity:.9; }
  `,
})
export class FpButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'danger'>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly testId = input<string | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly icon = input<FpIconName | undefined>(undefined);
}
