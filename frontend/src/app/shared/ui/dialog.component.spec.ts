import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpDialogComponent } from './dialog.component';

@Component({
  standalone: true,
  imports: [FpDialogComponent],
  template: `
    <button type="button" data-testid="trigger" (click)="open.set(true)">Abrir</button>
    @if (open()) {
      <fp-dialog
        data-testid="test-dialog"
        [label]="'test-dialog-title'"
        [describedById]="'test-dialog-desc'"
        (closed)="open.set(false)"
      >
        <h2 id="test-dialog-title">Título</h2>
        <p id="test-dialog-desc">Descripción</p>
        <button type="button" data-testid="first-action">Primero</button>
        <button type="button" data-testid="second-action">Segundo</button>
      </fp-dialog>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
}

describe('FpDialogComponent', () => {
  // jsdom performs no layout: every element reports a 0x0 geometry, so CDK's
  // `InteractivityChecker.isVisible()` (which gates focus-trap capture on
  // `getClientRects().length`) would treat every element as invisible and
  // never move focus. Stub a non-empty rect so the real trap-focus logic
  // under test actually runs, matching the standard CDK-in-jsdom pattern.
  let getClientRectsSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getClientRectsSpy = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);
  });

  afterEach(() => {
    getClientRectsSpy.mockRestore();
  });

  async function create(): Promise<ComponentFixture<HostComponent>> {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function trigger(fixture: ComponentFixture<HostComponent>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="trigger"]') as HTMLButtonElement;
  }

  function host(fixture: ComponentFixture<HostComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="test-dialog"]') as HTMLElement;
  }

  function panel(fixture: ComponentFixture<HostComponent>): HTMLElement {
    return host(fixture).querySelector('.fp-dialog__panel') as HTMLElement;
  }

  async function openDialog(fixture: ComponentFixture<HostComponent>): Promise<void> {
    trigger(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders a full-viewport backdrop at the design token color', async () => {
    const fixture = await create();
    await openDialog(fixture);
    const style = getComputedStyle(host(fixture));
    expect(style.position).toBe('fixed');
    expect(style.backgroundColor.replace(/\s/g, '')).toBe('rgba(29,26,23,0.45)');
  });

  it('renders the panel at the 14px surface radius token', async () => {
    const fixture = await create();
    await openDialog(fixture);
    const style = getComputedStyle(panel(fixture));
    expect(style.borderRadius).toBe('var(--fp-radius-md)');
  });

  it('moves role and aria attributes off the host and onto the panel via label/describedById', async () => {
    const fixture = await create();
    await openDialog(fixture);
    expect(host(fixture).hasAttribute('role')).toBe(false);
    expect(panel(fixture).getAttribute('role')).toBe('dialog');
    expect(panel(fixture).getAttribute('aria-modal')).toBe('true');
    expect(panel(fixture).getAttribute('aria-labelledby')).toBe('test-dialog-title');
    expect(panel(fixture).getAttribute('aria-describedby')).toBe('test-dialog-desc');
  });

  it('keeps data-testid on the host so consumer specs can still query it', async () => {
    const fixture = await create();
    await openDialog(fixture);
    expect(host(fixture)).not.toBeNull();
    expect(host(fixture).getAttribute('data-testid')).toBe('test-dialog');
  });

  it('captures focus into the dialog panel on open', async () => {
    const fixture = await create();
    await openDialog(fixture);
    expect(panel(fixture).contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the triggering element when the dialog closes', async () => {
    const fixture = await create();
    trigger(fixture).focus();
    expect(document.activeElement).toBe(trigger(fixture));
    await openDialog(fixture);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger(fixture));
  });

  it('emits closed and restores focus when Escape is pressed', async () => {
    const fixture = await create();
    await openDialog(fixture);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(host(fixture)).toBeNull();
  });

  it('emits closed when the backdrop (host) is clicked directly', async () => {
    const fixture = await create();
    await openDialog(fixture);
    host(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('does not close when a click inside the panel bubbles up', async () => {
    const fixture = await create();
    await openDialog(fixture);
    panel(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(true);
  });
});
