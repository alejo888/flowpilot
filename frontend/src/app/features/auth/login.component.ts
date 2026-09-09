import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { sanitizeReturnUrl } from '../../core/auth/return-url';
import { FpIconComponent } from '../../shared/ui/icon.component';

/**
 * Login form (spec: frontend-auth-session; return-URL preservation). Delegates
 * to {@link AuthStore.login} and navigates away from `/login` once the store
 * reports `isAuthenticated()`. If a `returnUrl` query param is present and
 * passes {@link sanitizeReturnUrl}'s open-redirect allow-list (design D4), it
 * navigates there; otherwise it falls back to `''` (design D4/Home route).
 *
 * Visual layer uses the shared `.auth-*` card primitives (styles.scss) that
 * register / forgot-password / reset-password also render — an icon-prefixed
 * field and a password reveal toggle the shared fp-input/fp-button kit doesn't
 * carry. Behaviour and the `login-email` / `login-password` / `login-error` /
 * `login-submit` test hooks are unchanged. Social sign-in and a "remember this
 * device" toggle from the mock are intentionally left out: there is no OAuth
 * backend, and the refresh-token TTL is fixed server-side.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-shell">
        <p class="auth-eyebrow"><span class="auth-eyebrow__dot"></span> Espacio de trabajo seguro</p>

        <div class="auth-card">
          <header class="auth-card__head">
            <h1 class="auth-card__title">Iniciar sesión</h1>
            <p class="auth-card__subtitle">
              Ingresá a tu cuenta para seguir gestionando tus proyectos en FlowPilot.
            </p>
          </header>

          <form class="auth-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="login-error" class="auth-form__error" role="alert">{{ message }}</p>
            }

            <label class="auth-field">
              <span class="auth-field__label">Email</span>
              <span class="auth-field__control">
                <fp-icon name="mail" class="auth-field__icon" />
                <input
                  #emailInput
                  data-testid="login-email"
                  type="email"
                  autocomplete="email"
                  required
                  placeholder="usuario@flowpilot.io"
                  [value]="email()"
                  (input)="email.set(emailInput.value)"
                />
              </span>
            </label>

            <label class="auth-field">
              <span class="auth-field__label">Contraseña</span>
              <span class="auth-field__control">
                <fp-icon name="lock" class="auth-field__icon" />
                <input
                  #passwordInput
                  data-testid="login-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  autocomplete="current-password"
                  required
                  placeholder="Tu contraseña"
                  [value]="password()"
                  (input)="password.set(passwordInput.value)"
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
            </label>

            <div class="auth-form__aux">
              <a routerLink="/forgot-password" class="auth-link">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" class="auth-submit" data-testid="login-submit" [disabled]="submitting()">
              <fp-icon name="key" /> Ingresar
            </button>
          </form>

          <hr class="auth-card__rule" />
          <p class="auth-card__foot">
            ¿No tenés cuenta? <a routerLink="/register" class="auth-link auth-link--strong">Registrate gratis</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  readonly error = this.store.error;

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        const requestedReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = sanitizeReturnUrl(requestedReturnUrl) ?? '';
        this.router.navigateByUrl(target);
      }
    });

    effect(() => {
      if (this.store.error() !== null) {
        this.submitting.set(false);
      }
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitting.set(true);
    this.store.login(this.email(), this.password());
  }
}
