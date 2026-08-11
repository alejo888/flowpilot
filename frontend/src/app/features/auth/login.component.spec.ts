import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let authStoreStub: {
    login: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof signal<string | null>>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };
  let activatedRouteStub: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  function setFieldValue(testId: string, value: string): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submitForm(): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
  }

  async function createFixture(returnUrl: string | null): Promise<void> {
    TestBed.resetTestingModule();
    activatedRouteStub = {
      snapshot: {
        queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthStore, useValue: authStoreStub },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    authStoreStub = {
      login: vi.fn(),
      error: signal<string | null>(null),
      isAuthenticated: signal(false),
    };
    router = { navigateByUrl: vi.fn() };

    await createFixture(null);
  });

  it('calls AuthStore.login with the entered email and password on submit', () => {
    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'secret123');

    submitForm();

    expect(authStoreStub.login).toHaveBeenCalledWith('user@flowpilot.local', 'secret123');
  });

  it('renders the RFC7807 detail message when AuthStore.error is set', () => {
    authStoreStub.error.set('Invalid email or password');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="login-error"]')?.textContent).toContain(
      'Invalid email or password',
    );
  });

  it('does not render an error message when AuthStore.error is null', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="login-error"]')).toBeNull();
  });

  it('navigates to "" once isAuthenticated becomes true when there is no returnUrl', () => {
    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'secret123');
    submitForm();

    authStoreStub.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('');
  });

  it('navigates to a valid returnUrl once isAuthenticated becomes true', async () => {
    await createFixture('/projects/1/board');

    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'secret123');
    submitForm();

    authStoreStub.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/projects/1/board');
  });

  it('falls back to "" when returnUrl is unsafe (open-redirect attempt)', async () => {
    await createFixture('https://evil.example.com');

    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'secret123');
    submitForm();

    authStoreStub.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('');
  });

  it('disables the submit button while the login request is pending, then re-enables it on error', () => {
    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'wrong');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('[data-testid="login-submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    authStoreStub.error.set('Invalid email or password');
    fixture.detectChanges();

    expect(button.disabled).toBe(false);
  });
});
