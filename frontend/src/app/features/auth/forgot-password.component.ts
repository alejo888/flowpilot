import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpIconComponent } from '../../shared/ui/icon.component';

/**
 * Password-reset request form (backend: `POST /api/auth/forgot-password`).
 * The endpoint always resolves with 200 regardless of whether the account
 * exists (no account enumeration, design decision on the backend side), so
 * this component shows the same generic confirmation on any successful
 * response and never distinguishes "email not found" from "email sent".
 * A genuine request failure (network/5xx) shows a separate generic error.
 *
 * Visual layer uses the shared `.auth-*` card primitives (styles.scss) in
 * their centred variant (`.auth-shell--centered`), the same as
 * {@link ResetPasswordComponent}. The mock's "contactar a soporte" link and
 * the SSL footer line are left out — there is no support desk and the
 * transport note added nothing. The `forgot-password-email` /
 * `forgot-password-submit` / `forgot-password-error` / `forgot-password-success`
 * test hooks are unchanged.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-shell auth-shell--centered">
        <p class="auth-eyebrow">
          <span class="auth-eyebrow__dot"></span> Recuperación segura
        </p>

        <div class="auth-card">
          @if (submitted()) {
            <span class="auth-card__badge" aria-hidden="true">
              <fp-icon name="check-circle" />
            </span>
            <header class="auth-card__head">
              <h1 class="auth-card__title">Revisá tu correo</h1>
              <p class="auth-card__subtitle" data-testid="forgot-password-success">
                Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.
              </p>
            </header>
          } @else {
            <span class="auth-card__badge" aria-hidden="true">
              <fp-icon name="key" />
            </span>
            <header class="auth-card__head">
              <h1 class="auth-card__title">Recuperar contraseña</h1>
              <p class="auth-card__subtitle">
                Ingresá el correo electrónico asociado a tu cuenta de FlowPilot y te enviaremos las
                instrucciones para restablecerla.
              </p>
            </header>

            <form class="auth-form" (submit)="onSubmit($event)">
              @if (error(); as message) {
                <p data-testid="forgot-password-error" class="auth-form__error" role="alert">
                  {{ message }}
                </p>
              }

              <label class="auth-field">
                <span class="auth-field__label">Email</span>
                <span class="auth-field__control">
                  <fp-icon name="mail" class="auth-field__icon" />
                  <input
                    #emailInput
                    data-testid="forgot-password-email"
                    type="email"
                    autocomplete="email"
                    required
                    placeholder="usuario@flowpilot.io"
                    [value]="email()"
                    (input)="email.set(emailInput.value)"
                  />
                </span>
              </label>

              <button
                type="submit"
                class="auth-submit"
                data-testid="forgot-password-submit"
                [disabled]="submitting()"
              >
                <fp-icon name="mail" /> Enviar enlace de recuperación
              </button>
            </form>
          }

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
export class ForgotPasswordComponent {
  private readonly api = inject(AuthApiService);

  readonly email = signal('');
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);

    this.api.forgotPassword({ email: this.email() }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('No pudimos procesar la solicitud. Probá de nuevo.');
      },
    });
  }
}
