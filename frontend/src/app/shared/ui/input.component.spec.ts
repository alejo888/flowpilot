import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpInputComponent } from './input.component';

describe('FpInputComponent', () => {
  let fixture: ComponentFixture<FpInputComponent>;

  function control(): HTMLElement {
    return fixture.nativeElement.querySelector('.fp-input__control') as HTMLElement;
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
});
