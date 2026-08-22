import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FpIconComponent } from './icon.component';

describe('FpIconComponent', () => {
  let fixture: ComponentFixture<FpIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FpIconComponent] }).compileComponents();
    fixture = TestBed.createComponent(FpIconComponent);
    fixture.componentRef.setInput('name', 'arrow-left');
    fixture.detectChanges();
  });

  it('renders a local inline SVG for every supported semantic icon', () => {
    const icon = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.querySelector('path')?.getAttribute('d')).toBeTruthy();
  });

  it('supports an accessible label when the icon is not decorative', () => {
    fixture.componentRef.setInput('ariaLabel', 'Volver a proyectos');
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('aria-hidden')).toBeNull();
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.getAttribute('aria-label')).toBe('Volver a proyectos');
  });
});
