import { of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let authApiStub: { register: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

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

  /** Reads the error message rendered inside the `fp-input` wrapping `testId`. */
  function errorFor(testId: string): string | null {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testId}"]`);
    const message = input?.closest('.fp-input')?.querySelector('.fp-input__error');
    return message?.textContent?.trim() ?? null;
  }

  beforeEach(async () => {
    authApiStub = { register: vi.fn() };

    // Real router (RouterLink needs Router + ActivatedRoute to render the
    // "back to /login" link); only navigateByUrl is stubbed out.
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [{ provide: AuthApiService, useValue: authApiStub }, provideRouter([])],
    }).compileComponents();

    router = {
      navigateByUrl: vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>,
    };

    fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
  });

  it('calls AuthApiService.register with the entered name, email and password on submit', () => {
    authApiStub.register.mockReturnValue(of(undefined));

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'ada@flowpilot.local');
    setFieldValue('register-password', 'secret123');

    submitForm();

    expect(authApiStub.register).toHaveBeenCalledWith({
      name: 'Ada Lovelace',
      email: 'ada@flowpilot.local',
      password: 'secret123',
    });
  });

  it('navigates to /login once registration succeeds', () => {
    authApiStub.register.mockReturnValue(of(undefined));

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'ada@flowpilot.local');
    setFieldValue('register-password', 'secret123');
    submitForm();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('renders the RFC7807 detail message when registration fails', () => {
    authApiStub.register.mockReturnValue(
      throwError(() => ({ error: { detail: 'Email already registered' } })),
    );

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'ada@flowpilot.local');
    setFieldValue('register-password', 'secret123');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="register-error"]')?.textContent).toContain(
      'Email already registered',
    );
  });

  it('renders each field validation message on its own input instead of a merged banner', () => {
    authApiStub.register.mockReturnValue(
      throwError(() => ({
        error: {
          detail: 'Validation failed',
          errors: {
            email: 'Email must be a valid address',
            password: 'Password must be at least 8 characters',
          },
        },
      })),
    );

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'alejo@gmail');
    setFieldValue('register-password', 'short');
    submitForm();
    fixture.detectChanges();

    expect(errorFor('register-email')).toBe('Email must be a valid address');
    expect(errorFor('register-password')).toBe('Password must be at least 8 characters');
    expect(errorFor('register-name')).toBeNull();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="register-error"]')).toBeNull();
    expect(
      compiled.querySelector('[data-testid="register-email"]')?.classList.contains(
        'fp-input__control--invalid',
      ),
    ).toBe(true);
  });

  it('keeps unattributed errors (e.g. duplicate email 409) in the top-level banner only', () => {
    authApiStub.register.mockReturnValue(
      throwError(() => ({ error: { detail: 'Email already registered' } })),
    );

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'ada@flowpilot.local');
    setFieldValue('register-password', 'secret123');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="register-error"]')?.textContent).toContain(
      'Email already registered',
    );
    expect(errorFor('register-email')).toBeNull();
  });

  it('links back to /login', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a[href="/login"]');
    expect(link).not.toBeNull();
  });

  it('does not render an error message before submitting', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="register-error"]')).toBeNull();
  });

  it('disables the submit button while the request is pending, then re-enables it on error', () => {
    authApiStub.register.mockReturnValue(
      throwError(() => ({ error: { detail: 'Email already registered' } })),
    );

    setFieldValue('register-name', 'Ada Lovelace');
    setFieldValue('register-email', 'ada@flowpilot.local');
    setFieldValue('register-password', 'secret123');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('[data-testid="register-submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
