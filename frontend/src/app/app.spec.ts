import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthStore } from './core/auth/auth.store';
import { App } from './app';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let authStoreStub: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    isAdmin: ReturnType<typeof signal<boolean>>;
    logout: ReturnType<typeof vi.fn>;
  };

  function createFixture(): void {
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    authStoreStub = {
      isAuthenticated: signal(false),
      isAdmin: signal(false),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStoreStub }],
    }).compileComponents();
  });

  it('should create the app shell', () => {
    createFixture();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the FlowPilot brand link', () => {
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-nav__brand')?.textContent).toContain('FlowPilot');
  });

  it('hides section nav links when not authenticated', () => {
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="nav-projects"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="logout-button"]')).toBeNull();
  });

  it('shows the projects link but not admin links for an authenticated non-admin user', () => {
    authStoreStub.isAuthenticated.set(true);
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="nav-projects"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="logout-button"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="nav-admin-users"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="nav-admin-permissions"]')).toBeNull();
  });

  it('shows admin links for an authenticated admin user', () => {
    authStoreStub.isAuthenticated.set(true);
    authStoreStub.isAdmin.set(true);
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="nav-admin-users"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="nav-admin-permissions"]')).not.toBeNull();
  });

  it('nav menu starts closed with the toggle collapsed', () => {
    authStoreStub.isAuthenticated.set(true);
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    const toggle = compiled.querySelector('[data-testid="nav-toggle"]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('[data-testid="nav-menu"]')?.classList.contains('app-nav__menu--open')).toBe(
      false,
    );
  });

  it('opens and closes the nav menu when the toggle is clicked', () => {
    authStoreStub.isAuthenticated.set(true);
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('[data-testid="nav-toggle"]') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('[data-testid="nav-menu"]')?.classList.contains('app-nav__menu--open')).toBe(
      true,
    );

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('[data-testid="nav-menu"]')?.classList.contains('app-nav__menu--open')).toBe(
      false,
    );
  });

  it('closes the nav menu after a section link is clicked', async () => {
    authStoreStub.isAuthenticated.set(true);
    createFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('[data-testid="nav-toggle"]') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    (compiled.querySelector('[data-testid="nav-projects"]') as HTMLElement).click();
    fixture.detectChanges();
    // routerLink triggers a real (routeless, thus rejected) navigation;
    // let it settle inside the test instead of after teardown, or it
    // surfaces as an unhandled rejection (NG0205) once the fixture is gone.
    await fixture.whenStable().catch(() => undefined);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('logs out and navigates to /login when the logout button is clicked', () => {
    authStoreStub.isAuthenticated.set(true);
    createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutButton = compiled.querySelector('[data-testid="logout-button"]') as HTMLButtonElement;
    logoutButton.click();

    expect(authStoreStub.logout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
