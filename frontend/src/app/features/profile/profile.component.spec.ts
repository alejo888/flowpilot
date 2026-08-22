import { of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileApiService } from './profile-api.service';
import { ProfileComponent } from './profile.component';
import { UserProfile } from './profile.model';

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let apiStub: {
    getCurrentUser: ReturnType<typeof vi.fn>;
    changePassword: ReturnType<typeof vi.fn>;
  };

  function profile(): UserProfile {
    return { id: 1, name: 'Ada Lovelace', email: 'ada@flowpilot.local', role: 'MIEMBRO_EQUIPO', active: true };
  }

  function setFieldValue(testId: string, value: string): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitForm(): void {
    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  /** Reads the error message rendered inside the `fp-input` wrapping `testId`. */
  function errorFor(testId: string): string | null {
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(`[data-testid="${testId}"]`);
    const message = input?.closest('.fp-input')?.querySelector('.fp-input__error');
    return message?.textContent?.trim() ?? null;
  }

  function fillValidChangePasswordForm(): void {
    setFieldValue('profile-current-password', 'oldSecret1');
    setFieldValue('profile-new-password', 'newSecret1');
    setFieldValue('profile-confirm-password', 'newSecret1');
  }

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [{ provide: ProfileApiService, useValue: apiStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    apiStub = {
      getCurrentUser: vi.fn().mockReturnValue(of(profile())),
      changePassword: vi.fn(),
    };
  });

  it('fetches and displays the caller own name and email on init', async () => {
    await setup();

    expect(apiStub.getCurrentUser).toHaveBeenCalled();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="profile-name"]')?.textContent).toContain('Ada Lovelace');
    expect(compiled.querySelector('[data-testid="profile-email"]')?.textContent).toContain('ada@flowpilot.local');
  });

  it('keeps identity and password sections in a responsive profile layout', async () => {
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.profile-sections')).not.toBeNull();
    expect(compiled.querySelector('.profile-password-card')).not.toBeNull();
  });

  it('shows a load error when the profile fetch fails', async () => {
    apiStub.getCurrentUser.mockReturnValue(throwError(() => ({ error: { detail: 'boom' } })));
    await setup();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="profile-load-error"]')).toBeTruthy();
  });

  it('blocks submission client-side when the new password is too short', async () => {
    await setup();

    setFieldValue('profile-current-password', 'oldSecret1');
    setFieldValue('profile-new-password', 'short');
    setFieldValue('profile-confirm-password', 'short');
    submitForm();

    expect(errorFor('profile-new-password')).toContain('al menos 8 caracteres');
    expect(apiStub.changePassword).not.toHaveBeenCalled();
  });

  it('blocks submission client-side when the confirmation does not match', async () => {
    await setup();

    setFieldValue('profile-current-password', 'oldSecret1');
    setFieldValue('profile-new-password', 'newSecret1');
    setFieldValue('profile-confirm-password', 'somethingElse1');
    submitForm();

    expect(errorFor('profile-confirm-password')).toContain('no coinciden');
    expect(apiStub.changePassword).not.toHaveBeenCalled();
  });

  it('calls changePassword with current and new password on valid submit', async () => {
    apiStub.changePassword.mockReturnValue(of(undefined));
    await setup();

    fillValidChangePasswordForm();
    submitForm();

    expect(apiStub.changePassword).toHaveBeenCalledWith({
      currentPassword: 'oldSecret1',
      newPassword: 'newSecret1',
    });
  });

  it('clears the password fields and shows a success message once the change succeeds', async () => {
    apiStub.changePassword.mockReturnValue(of(undefined));
    await setup();

    fillValidChangePasswordForm();
    submitForm();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="profile-password-success"]')).toBeTruthy();
    expect((compiled.querySelector('[data-testid="profile-current-password"]') as HTMLInputElement).value).toBe('');
    expect((compiled.querySelector('[data-testid="profile-new-password"]') as HTMLInputElement).value).toBe('');
    expect((compiled.querySelector('[data-testid="profile-confirm-password"]') as HTMLInputElement).value).toBe('');
  });

  it('shows the server error banner when the current password is wrong', async () => {
    apiStub.changePassword.mockReturnValue(
      throwError(() => ({ error: { detail: 'La contraseña actual no es correcta' } })),
    );
    await setup();

    fillValidChangePasswordForm();
    submitForm();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="profile-password-error"]')?.textContent).toContain(
      'La contraseña actual no es correcta',
    );
  });

  it('disables the submit button while the request is in flight', async () => {
    apiStub.changePassword.mockReturnValue({ subscribe: () => ({}) });
    await setup();

    fillValidChangePasswordForm();
    submitForm();

    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('[data-testid="profile-password-submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });
});
