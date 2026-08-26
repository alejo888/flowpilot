import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpInputComponent } from './input.component';

describe('FpInputComponent', () => {
  let fixture: ComponentFixture<FpInputComponent>;

  function control(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.fp-input__control') as HTMLInputElement;
  }

  function errorSpan(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.fp-input__error');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FpInputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FpInputComponent);
    fixture.detectChanges();
  });

  it('uses the control radius token, not the surface radius token', () => {
    const style = getComputedStyle(control());
    expect(style.borderRadius).toBe('var(--fp-radius-sm)');
  });

  it('has no aria-describedby or aria-invalid when there is no error', () => {
    expect(control().getAttribute('aria-describedby')).toBeNull();
    expect(control().getAttribute('aria-invalid')).toBeNull();
    expect(errorSpan()).toBeNull();
  });

  it('links the error span to the input via aria-describedby and sets aria-invalid', () => {
    fixture.componentRef.setInput('error', 'Campo inválido');
    fixture.detectChanges();

    const error = errorSpan();
    expect(error).not.toBeNull();
    expect(error?.id).toBeTruthy();
    expect(control().getAttribute('aria-describedby')).toBe(error?.id);
    expect(control().getAttribute('aria-invalid')).toBe('true');
  });

  it('gives every instance a distinct error id', () => {
    const other = TestBed.createComponent(FpInputComponent);
    other.componentRef.setInput('error', 'Otro error');
    fixture.componentRef.setInput('error', 'Error');
    fixture.detectChanges();
    other.detectChanges();

    const firstId = errorSpan()?.id;
    const secondId = (other.nativeElement as HTMLElement).querySelector('.fp-input__error')?.id;
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  it('does not set autocomplete by default and forwards it when provided', () => {
    expect(control().hasAttribute('autocomplete')).toBe(false);

    fixture.componentRef.setInput('autocomplete', 'new-password');
    fixture.detectChanges();

    expect(control().getAttribute('autocomplete')).toBe('new-password');
  });
});
