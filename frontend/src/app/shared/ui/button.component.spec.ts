import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpButtonComponent } from './button.component';

describe('FpButtonComponent', () => {
  let fixture: ComponentFixture<FpButtonComponent>;

  function button(): HTMLElement {
    return fixture.nativeElement.querySelector('.fp-button') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FpButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FpButtonComponent);
    fixture.detectChanges();
  });

  it('uses the control radius token, not the surface radius token', () => {
    const style = getComputedStyle(button());
    expect(style.borderRadius).toBe('var(--fp-radius-sm)');
  });

  it('has no accessible name by default', () => {
    expect(button().getAttribute('aria-label')).toBeNull();
  });

  it('renders an optional local SVG icon without ligature text or replacing visible button text', () => {
    fixture.componentRef.setInput('icon', 'save');
    fixture.detectChanges();

    const icon = button().querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.querySelector('path')?.getAttribute('d')).toContain('M17');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.textContent?.trim()).toBe('');
    expect(button().textContent).not.toContain('save');
  });

  it('forwards ariaLabel onto the native button, not the host element', () => {
    fixture.componentRef.setInput('ariaLabel', 'Cerrar detalle');
    fixture.detectChanges();

    expect(button().getAttribute('aria-label')).toBe('Cerrar detalle');
  });
});
