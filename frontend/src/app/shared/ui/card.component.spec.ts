import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpCardComponent } from './card.component';

describe('FpCardComponent', () => {
  let fixture: ComponentFixture<FpCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FpCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FpCardComponent);
    fixture.detectChanges();
  });

  it('uses the surface radius token, not the control radius token', () => {
    const style = getComputedStyle(fixture.nativeElement as HTMLElement);
    expect(style.borderRadius).toBe('var(--fp-radius-md)');
  });
});
