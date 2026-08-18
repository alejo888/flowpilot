import { of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let authApiStub: { forgotPassword: ReturnType<typeof vi.fn> };

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
    authApiStub = { forgotPassword: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [{ provide: AuthApiService, useValue: authApiStub }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
  });

  it('calls AuthApiService.forgotPassword with the entered email on submit', () => {
    authApiStub.forgotPassword.mockReturnValue(of(undefined));

    setFieldValue('forgot-password-email', 'ada@flowpilot.local');
    submitForm();

    expect(authApiStub.forgotPassword).toHaveBeenCalledWith({ email: 'ada@flowpilot.local' });
  });

  it('shows a generic confirmation message once the request resolves, regardless of whether the account exists', () => {
    authApiStub.forgotPassword.mockReturnValue(of(undefined));

    setFieldValue('forgot-password-email', 'unknown@flowpilot.local');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="forgot-password-success"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="forgot-password-error"]')).toBeNull();
  });

  it('shows a generic error message when the request itself fails (e.g. network/5xx)', () => {
    authApiStub.forgotPassword.mockReturnValue(throwError(() => new Error('network error')));

    setFieldValue('forgot-password-email', 'ada@flowpilot.local');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="forgot-password-error"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="forgot-password-success"]')).toBeNull();
  });

  it('links back to /login from the form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('still links back to /login from the post-submit confirmation', () => {
    authApiStub.forgotPassword.mockReturnValue(of(undefined));

    setFieldValue('forgot-password-email', 'ada@flowpilot.local');
    submitForm();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="forgot-password-success"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('does not render a confirmation or error message before submitting', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="forgot-password-success"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="forgot-password-error"]')).toBeNull();
  });
});
