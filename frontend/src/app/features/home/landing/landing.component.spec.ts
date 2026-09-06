import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the hero with the projects call-to-action', () => {
    const link = el().querySelector('[data-testid="home-projects-link"]');
    expect(link?.getAttribute('href')).toBe('/projects');
    expect(link?.textContent).toContain('Mis proyectos');
  });

  it('exposes the in-page nav anchor targets', () => {
    expect(el().querySelector('#flujo')).not.toBeNull();
    expect(el().querySelector('#caracteristicas')).not.toBeNull();
  });

  it('renders the mock board columns and the three feature pillars', () => {
    expect(el().querySelectorAll('.lp-col').length).toBe(4);
    expect(el().querySelectorAll('.lp-pillar').length).toBe(3);
  });

  it('closes with the CTA band and footer', () => {
    expect(el().querySelector('.lp-cta')).not.toBeNull();
    expect(el().querySelector('.lp-footer')?.textContent).toContain('FlowPilot');
  });
});
