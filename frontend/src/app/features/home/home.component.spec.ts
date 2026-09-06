import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { AccessNoticeStore } from '../../core/notifications/access-notice.store';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let accessNoticeStub: { consume: ReturnType<typeof vi.fn> };
  let authStub: { isAuthenticated: ReturnType<typeof signal<boolean>> };

  beforeEach(async () => {
    accessNoticeStub = { consume: vi.fn().mockReturnValue(null) };
    authStub = { isAuthenticated: signal(false) };

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: AccessNoticeStore, useValue: accessNoticeStub },
        { provide: AuthStore, useValue: authStub },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('consumes any pending access notice exactly once on init', () => {
    accessNoticeStub.consume.mockReturnValue('No tienes acceso a esta sección.');

    render();

    expect(accessNoticeStub.consume).toHaveBeenCalledTimes(1);
  });

  describe('authenticated', () => {
    beforeEach(() => authStub.isAuthenticated.set(true));

    it('renders the compact welcome panel, not the marketing landing', () => {
      const compiled = render();

      expect(compiled.querySelector('[data-testid="home-welcome-panel"]')).not.toBeNull();
      expect(compiled.querySelector('[data-testid="home-quick-actions"]')).not.toBeNull();
      expect(compiled.querySelector('app-landing')).toBeNull();
    });

    it('links to the projects list', () => {
      const compiled = render();

      const link = compiled.querySelector('[data-testid="home-projects-link"]');
      expect(link?.getAttribute('href')).toBe('/projects');
      expect(link?.textContent).toContain('Mis proyectos');
    });

    it('renders the pending access-denial notice', () => {
      accessNoticeStub.consume.mockReturnValue('No tienes acceso a esta sección.');

      const compiled = render();

      expect(compiled.querySelector('[data-testid="home-notice"]')?.textContent).toContain(
        'No tienes acceso a esta sección.',
      );
    });

    it('renders no notice when none is pending', () => {
      const compiled = render();

      expect(compiled.querySelector('[data-testid="home-notice"]')).toBeNull();
    });
  });

  describe('unauthenticated', () => {
    it('renders the marketing landing instead of the welcome panel', () => {
      const compiled = render();

      expect(compiled.querySelector('app-landing')).not.toBeNull();
      // the landing hero carries the same welcome-panel / projects-link hooks
      expect(compiled.querySelector('[data-testid="home-welcome-panel"]')).not.toBeNull();
      expect(
        compiled.querySelector('[data-testid="home-projects-link"]')?.getAttribute('href'),
      ).toBe('/projects');
    });

    it('never shows the access notice on the public landing', () => {
      accessNoticeStub.consume.mockReturnValue('No tienes acceso a esta sección.');

      const compiled = render();

      expect(compiled.querySelector('[data-testid="home-notice"]')).toBeNull();
      expect(accessNoticeStub.consume).toHaveBeenCalledTimes(1);
    });
  });
});
