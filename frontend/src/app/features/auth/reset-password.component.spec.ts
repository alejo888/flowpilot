import { of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let authApiStub: { resetPassword: ReturnType<typeof vi.fn> };
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

  /** Reads the error message rendered inside the field wrapping `testId`. */
  function errorFor(testId: string): string | null {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testId}"]`);
    const message = input?.closest('.reset-password-field')?.querySelector('.reset-password-field__error');
    return message?.textContent?.trim() ?? null;
  }

  async function createFixture(token: string | null): Promise<void> {
    TestBed.resetTestingModule();
    activatedRouteStub = {
      snapshot: {
        queryParamMap: convertToParamMap(token ? { token } : {}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        { provide: AuthApiService, useValue: authApiStub },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: activatedRouteStub },
      ],
    }).compileComponents();

    router = {
      navigateByUrl: vi
        .spyOn(TestBed.inject(Router), 'navigateByUrl')
        .mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>,
    };

    fixture = TestBed.createComponent(ResetPasswordComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    authApiStub = { resetPassword: vi.fn() };

    await createFixture('reset-token-1');
  });

  it('calls AuthApiService.resetPassword with the query-param token and entered password on submit', () => {
    authApiStub.resetPassword.mockReturnValue(of(undefined));

    setFieldValue('reset-password-new-password', 'newSecret123');
    submitForm();

    expect(authApiStub.resetPassword).toHaveBeenCalledWith({
      token: 'reset-token-1',
      newPassword: 'newSecret123',
    });
  });

  it('navigates to /login once the reset succeeds', () => {
    authApiStub.resetPassword.mockReturnValue(of(undefined));

    setFieldValue('reset-password-new-password', 'newSecret123');
    submitForm();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('renders the RFC7807 detail message when the token is invalid or expired', () => {
    authApiStub.resetPassword.mockReturnValue(
      throwError(() => ({ error: { detail: 'Token expired' } })),
    );

    setFieldValue('reset-password-new-password', 'newSecret123');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="reset-password-error"]')?.textContent).toContain(
      'Token expired',
    );
  });

  it('shows an error and does not call the API when there is no token in the URL', async () => {
    await createFixture(null);

    setFieldValue('reset-password-new-password', 'newSecret123');
    submitForm();
    fixture.detectChanges();

    expect(authApiStub.resetPassword).not.toHaveBeenCalled();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="reset-password-error"]')).not.toBeNull();
  });

  it('renders the field validation message on the password input instead of the banner', () => {
    authApiStub.resetPassword.mockReturnValue(
      throwError(() => ({
        error: {
          detail: 'Validation failed',
          errors: { newPassword: 'Password must be at least 8 characters' },
        },
      })),
    );

    setFieldValue('reset-password-new-password', 'short');
    submitForm();
    fixture.detectChanges();

    expect(errorFor('reset-password-new-password')).toBe('Password must be at least 8 characters');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="reset-password-error"]')).toBeNull();
    expect(
      compiled
        .querySelector('[data-testid="reset-password-new-password"]')
        ?.closest('.reset-password-field__control')
        ?.classList.contains('reset-password-field__control--invalid'),
    ).toBe(true);
  });

  it('does not render an error message before submitting', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="reset-password-error"]')).toBeNull();
  });

  it('marks the password field as required', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(
      '[data-testid="reset-password-new-password"]',
    ) as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  it('toggles the password field between masked and visible and reflects it in aria-pressed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(
      '[data-testid="reset-password-new-password"]',
    ) as HTMLInputElement;
    const toggle = compiled.querySelector('.reset-password-field__toggle') as HTMLButtonElement;

    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('links back to /login', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href="/login"]')).not.toBeNull();
  });
});
