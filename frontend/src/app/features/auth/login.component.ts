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
 * Visual layer is a bespoke card in the redesign scale (blue/slate `--lp-*`),
 * with icon-prefixed fields and a password reveal toggle — the shared
 * fp-input/fp-button kit doesn't carry those affordances and only this screen
 * needs them. Behaviour and the `login-email` / `login-password` /
 * `login-error` / `login-submit` test hooks are unchanged. Social sign-in and
 * a "remember this device" toggle from the mock are intentionally left out:
 * there is no OAuth backend, and the refresh-token TTL is fixed server-side.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="login-page auth-page">
      <div class="login-shell">
        <p class="login-eyebrow"><span class="login-eyebrow__dot"></span> Espacio de trabajo seguro</p>

        <div class="login-card">
          <header class="login-card__head">
            <h1 class="login-card__title">Iniciar sesión</h1>
            <p class="login-card__subtitle">
              Ingresá a tu cuenta para seguir gestionando tus proyectos en FlowPilot.
            </p>
          </header>

          <form class="login-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="login-error" class="login-form__error" role="alert">{{ message }}</p>
            }

            <label class="login-field">
              <span class="login-field__label">Email</span>
              <span class="login-field__control">
                <fp-icon name="mail" class="login-field__icon" />
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

            <label class="login-field">
              <span class="login-field__label">Contraseña</span>
              <span class="login-field__control">
                <fp-icon name="lock" class="login-field__icon" />
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
                  class="login-field__toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <fp-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </span>
            </label>

            <div class="login-form__aux">
              <a routerLink="/forgot-password" class="login-link">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" class="login-submit" data-testid="login-submit" [disabled]="submitting()">
              <fp-icon name="key" /> Ingresar
            </button>
          </form>

          <hr class="login-card__rule" />
          <p class="login-card__foot">
            ¿No tenés cuenta? <a routerLink="/register" class="login-link login-link--strong">Registrate gratis</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* the blueprint grid + ground are painted on <body> (styles.scss,
       body:has(.login-page)) so they cover the whole viewport, not just this
       wrapper's content box */
    .login-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1.5rem, 6vw, 4rem) 1rem;
    }

    .login-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 480px;
    }

    .login-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      border: 1px solid var(--lp-line);
      background: var(--lp-surface);
      color: var(--lp-brand);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .login-eyebrow__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--lp-brand); }

    .login-card {
      width: 100%;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      background: var(--lp-surface);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    }

    .login-card__head { text-align: center; margin-bottom: 1.5rem; }
    .login-card__title { margin: 0; font-family: var(--fp-font-body); font-size: 1.6rem; font-weight: 800; color: var(--lp-ink); }
    .login-card__subtitle { margin: 0.5rem auto 0; max-width: 32ch; color: var(--lp-muted); font-size: 0.9rem; line-height: 1.5; }

    .login-form { display: flex; flex-direction: column; gap: 1rem; }

    .login-form__error {
      margin: 0;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      background: #fef2f2;
      color: var(--fp-danger);
      font-size: 0.85rem;
    }

    .login-field { display: flex; flex-direction: column; gap: 0.4rem; }
    .login-field__label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--lp-muted);
    }
    .login-field__control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--lp-line);
      border-radius: 12px;
      background: var(--lp-surface);
    }
    .login-field__control:focus-within { border-color: var(--lp-brand); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12); }
    .login-field__control input {
      flex: 1;
      min-width: 0;
      padding: 0.7rem 0;
      border: 0;
      background: transparent;
      font-family: var(--fp-font-body);
      font-size: 0.95rem;
      color: var(--lp-ink);
    }
    .login-field__control input:focus { outline: none; }
    /* keep the field white under browser autofill, and drop the native
       password-reveal so only our toggle shows */
    .login-field__control input:-webkit-autofill,
    .login-field__control input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 100px var(--lp-surface) inset;
      -webkit-text-fill-color: var(--lp-ink);
    }
    .login-field__control input::-ms-reveal,
    .login-field__control input::-ms-clear { display: none; }
    .login-field__icon { color: #94a3b8; flex: 0 0 auto; }

    .login-field__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      border: 0;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
    }
    .login-field__toggle:hover { color: var(--lp-brand); }
    .login-field__toggle:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; border-radius: 6px; }

    .login-form__aux { display: flex; justify-content: flex-end; margin-top: -0.25rem; }

    .login-link { color: var(--lp-brand); font-size: 0.85rem; font-weight: 600; text-decoration: none; }
    .login-link:hover { text-decoration: underline; }
    .login-link--strong { font-weight: 700; }

    .login-submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
      padding: 0.8rem 1rem;
      border: 0;
      border-radius: 12px;
      background: var(--lp-brand);
      color: #fff;
      font-family: var(--fp-font-body);
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.15s ease, opacity 0.15s ease;
    }
    .login-submit:hover:not(:disabled) { background: var(--lp-brand-hover); }
    .login-submit:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; }
    .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .login-card__rule { margin: 1.5rem 0 1rem; border: 0; border-top: 1px solid var(--lp-line); }
    .login-card__foot { margin: 0; text-align: center; color: var(--lp-muted); font-size: 0.88rem; }

    fp-icon .fp-icon { width: 1.05rem; height: 1.05rem; }
    .login-submit .fp-icon { width: 1rem; height: 1rem; }
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
