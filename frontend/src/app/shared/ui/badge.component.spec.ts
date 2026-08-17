import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpBadgeComponent } from './badge.component';

@Component({
  standalone: true,
  imports: [FpBadgeComponent],
  template: `<fp-badge [variant]="variant">{{ text }}</fp-badge>`,
})
class HostComponent {
  variant: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  text = 'ACTIVO';
}

describe('FpBadgeComponent', () => {
  function span(fixture: ComponentFixture<HostComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('.fp-badge') as HTMLElement;
  }

  async function createWithVariant(
    variant: 'success' | 'warning' | 'danger' | 'neutral',
  ): Promise<ComponentFixture<HostComponent>> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant = variant;
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('projects the given content inside the badge span', async () => {
    const fixture = await createWithVariant('neutral');
    expect(span(fixture).textContent?.trim()).toBe('ACTIVO');
  });

  it('uses the pill radius token, not the surface radius token', async () => {
    const fixture = await createWithVariant('neutral');
    const style = getComputedStyle(span(fixture));
    expect(style.borderRadius).toBe('var(--fp-radius-pill)');
  });

  it('uses the dedicated status-neutral color token for the neutral variant', async () => {
    const fixture = await createWithVariant('neutral');
    const style = getComputedStyle(span(fixture));
    expect(style.color).toBe('var(--fp-status-neutral)');
  });

  it('keeps the success variant on the semantic success color token', async () => {
    const fixture = await createWithVariant('success');
    const style = getComputedStyle(span(fixture));
    expect(style.color).toBe('var(--fp-success)');
  });

  it('keeps the danger variant on the semantic danger color token', async () => {
    const fixture = await createWithVariant('danger');
    const style = getComputedStyle(span(fixture));
    expect(style.color).toBe('var(--fp-danger)');
  });
});
