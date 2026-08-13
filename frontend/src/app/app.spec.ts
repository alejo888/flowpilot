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
