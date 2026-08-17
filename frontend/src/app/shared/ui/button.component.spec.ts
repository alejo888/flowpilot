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

  it('forwards ariaLabel onto the native button, not the host element', () => {
    fixture.componentRef.setInput('ariaLabel', 'Cerrar detalle');
    fixture.detectChanges();

    expect(button().getAttribute('aria-label')).toBe('Cerrar detalle');
  });
});
