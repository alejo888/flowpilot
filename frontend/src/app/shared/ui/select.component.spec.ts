import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpSelectComponent } from './select.component';

describe('FpSelectComponent', () => {
  let fixture: ComponentFixture<FpSelectComponent>;

  function control(): HTMLElement {
    return fixture.nativeElement.querySelector('.fp-select__control') as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FpSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FpSelectComponent);
    fixture.detectChanges();
  });

  it('uses the control radius token, not the surface radius token', () => {
    const style = getComputedStyle(control());
    expect(style.borderRadius).toBe('var(--fp-radius-sm)');
  });
});
