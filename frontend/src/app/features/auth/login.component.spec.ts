import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let authStoreStub: {
    login: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof signal<string | null>>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

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

  beforeEach(async () => {
    authStoreStub = {
      login: vi.fn(),
      error: signal<string | null>(null),
      isAuthenticated: signal(false),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthStore, useValue: authStoreStub },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
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

  it('navigates away from /login once isAuthenticated becomes true', () => {
    setFieldValue('login-email', 'user@flowpilot.local');
    setFieldValue('login-password', 'secret123');
    submitForm();

    authStoreStub.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
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
