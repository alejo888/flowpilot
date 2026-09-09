import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpIconComponent } from '../../shared/ui/icon.component';

interface ProblemDetailLike {
  error?: { detail?: string; errors?: Record<string, string> };
}

/**
 * Password-reset form (backend: `POST /api/auth/reset-password`). Reads the
 * reset `token` from the `token` query param the same way {@link LoginComponent}
 * reads `returnUrl` — via `route.snapshot.queryParamMap`. A missing token is
 * a client-side error (no point calling the API); an unknown/expired/used
 * token surfaces the backend's RFC 7807 detail.
 *
 * Visual layer uses the shared `.auth-*` card primitives (styles.scss) in
 * their centred variant (`.auth-shell--centered`), the same as
 * {@link ForgotPasswordComponent}, plus a password reveal toggle. The submit /
 * field-error routing and the `reset-password-*` test hooks are unchanged.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-shell auth-shell--centered">
        <p class="auth-eyebrow">
          <span class="auth-eyebrow__dot"></span> Recuperación segura
        </p>

        <div class="auth-card">
          <span class="auth-card__badge" aria-hidden="true">
            <fp-icon name="key" />
          </span>
          <header class="auth-card__head">
            <h1 class="auth-card__title">Restablecer contraseña</h1>
            <p class="auth-card__subtitle">
              Elegí una nueva contraseña para tu cuenta de FlowPilot.
            </p>
          </header>

          <form class="auth-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="reset-password-error" class="auth-form__error" role="alert">
                {{ message }}
              </p>
            }

            <label class="auth-field">
              <span class="auth-field__label">Nueva contraseña</span>
              <span
                class="auth-field__control"
                [class.auth-field__control--invalid]="newPasswordError()"
              >
                <fp-icon name="lock" class="auth-field__icon" />
                <input
                  #passwordInput
                  data-testid="reset-password-new-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  placeholder="Mínimo 8 caracteres"
                  [value]="newPassword()"
                  (input)="newPassword.set(passwordInput.value)"
                />
                <button
                  type="button"
                  class="auth-field__toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <fp-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </span>
              @if (newPasswordError(); as message) {
                <span class="auth-field__error">{{ message }}</span>
              }
              <span class="auth-field__hint">Mínimo 8 caracteres</span>
            </label>

            <button
              type="submit"
              class="auth-submit"
              data-testid="reset-password-submit"
              [disabled]="submitting()"
            >
              <fp-icon name="key" /> Restablecer contraseña
            </button>
          </form>

          <hr class="auth-card__rule" />
          <p class="auth-card__foot">
            <a routerLink="/login" class="auth-link auth-link--strong">
              <span aria-hidden="true">←</span> Volver a iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly newPassword = signal('');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly newPasswordError = computed(() => this.fieldErrors()['newPassword'] ?? null);

  onSubmit(event: Event): void {
    event.preventDefault();
    this.error.set(null);
    this.fieldErrors.set({});

    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('El enlace de restablecimiento no es válido. Solicitá uno nuevo.');
      return;
    }

    this.submitting.set(true);
    this.api.resetPassword({ token, newPassword: this.newPassword() }).subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: (err: unknown) => {
        this.submitting.set(false);
        this.applyError(err);
      },
    });
  }

  /**
   * Field-attributed validation errors go to their own input (see
   * {@link RegisterComponent}); anything else stays in the top-level banner.
   */
  private applyError(err: unknown): void {
    const problem = err as ProblemDetailLike;
    const fieldErrors = problem?.error?.errors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      this.fieldErrors.set({ ...fieldErrors });
      const unattributed = Object.entries(fieldErrors)
        .filter(([field]) => field !== 'newPassword')
        .map(([, message]) => message);
      this.error.set(unattributed.length > 0 ? unattributed.join(' ') : null);
      return;
    }
    this.error.set(problem?.error?.detail ?? 'No se pudo restablecer la contraseña');
  }
}
