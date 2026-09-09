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
 * Visual layer mirrors {@link LoginComponent} / {@link RegisterComponent}: a
 * bespoke card in the blue/slate `--lp-*` scale with an icon-prefixed field
 * and the blueprint-grid background. The mock's "contactar a soporte" link and
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
    <div class="forgot-password-page auth-page">
      <div class="forgot-password-shell">
        <p class="forgot-password-eyebrow">
          <span class="forgot-password-eyebrow__dot"></span> Recuperación segura
        </p>

        <div class="forgot-password-card">
          @if (submitted()) {
            <span class="forgot-password-card__badge" aria-hidden="true">
              <fp-icon name="check-circle" />
            </span>
            <header class="forgot-password-card__head">
              <h1 class="forgot-password-card__title">Revisá tu correo</h1>
              <p class="forgot-password-card__subtitle" data-testid="forgot-password-success">
                Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.
              </p>
            </header>
          } @else {
            <span class="forgot-password-card__badge" aria-hidden="true">
              <fp-icon name="key" />
            </span>
            <header class="forgot-password-card__head">
              <h1 class="forgot-password-card__title">Recuperar contraseña</h1>
              <p class="forgot-password-card__subtitle">
                Ingresá el correo electrónico asociado a tu cuenta de FlowPilot y te enviaremos las
                instrucciones para restablecerla.
              </p>
            </header>

            <form class="forgot-password-form" (submit)="onSubmit($event)">
              @if (error(); as message) {
                <p data-testid="forgot-password-error" class="forgot-password-form__error" role="alert">
                  {{ message }}
                </p>
              }

              <label class="forgot-password-field">
                <span class="forgot-password-field__label">Email</span>
                <span class="forgot-password-field__control">
                  <fp-icon name="mail" class="forgot-password-field__icon" />
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
                class="forgot-password-submit"
                data-testid="forgot-password-submit"
                [disabled]="submitting()"
              >
                <fp-icon name="mail" /> Enviar enlace de recuperación
              </button>
            </form>
          }

          <hr class="forgot-password-card__rule" />
          <p class="forgot-password-card__foot">
            <a routerLink="/login" class="forgot-password-link forgot-password-link--strong">
              <span aria-hidden="true">←</span> Volver a iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* ground + blueprint grid are painted on <body> (styles.scss,
       body:has(.forgot-password-page)) so they cover the whole viewport */
    .forgot-password-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1.5rem, 6vw, 4rem) 1rem;
    }

    .forgot-password-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 460px;
    }

    .forgot-password-eyebrow {
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
    .forgot-password-eyebrow__dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--lp-brand);
    }

    .forgot-password-card {
      width: 100%;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      background: var(--lp-surface);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
      text-align: center;
    }

    .forgot-password-card__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      background: var(--lp-brand-soft);
      color: var(--lp-brand);
    }
    .forgot-password-card__badge .fp-icon { width: 1.4rem; height: 1.4rem; }

    .forgot-password-card__head { margin: 1rem 0 1.5rem; }
    .forgot-password-card__title {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--lp-ink);
    }
    .forgot-password-card__subtitle {
      margin: 0.5rem auto 0;
      max-width: 40ch;
      color: var(--lp-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .forgot-password-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; }

    .forgot-password-form__error {
      margin: 0;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      background: #fef2f2;
      color: var(--fp-danger);
      font-size: 0.85rem;
    }

    .forgot-password-field { display: flex; flex-direction: column; gap: 0.4rem; }
    .forgot-password-field__label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--lp-muted);
    }
    .forgot-password-field__control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--lp-line);
      border-radius: 12px;
      background: var(--lp-surface);
    }
    .forgot-password-field__control:focus-within {
      border-color: var(--lp-brand);
      box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
    }
    .forgot-password-field__control input {
      flex: 1;
      min-width: 0;
      padding: 0.7rem 0;
      border: 0;
      background: transparent;
      font-family: var(--fp-font-body);
      font-size: 0.95rem;
      color: var(--lp-ink);
    }
    .forgot-password-field__control input:focus { outline: none; }
    .forgot-password-field__control input:-webkit-autofill,
    .forgot-password-field__control input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 100px var(--lp-surface) inset;
      -webkit-text-fill-color: var(--lp-ink);
    }
    .forgot-password-field__icon { color: #94a3b8; flex: 0 0 auto; }

    .forgot-password-submit {
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
    .forgot-password-submit:hover:not(:disabled) { background: var(--lp-brand-hover); }
    .forgot-password-submit:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; }
    .forgot-password-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .forgot-password-submit .fp-icon { width: 1rem; height: 1rem; }

    .forgot-password-card__rule { margin: 1.5rem 0 1rem; border: 0; border-top: 1px solid var(--lp-line); }
    .forgot-password-card__foot { margin: 0; color: var(--lp-muted); font-size: 0.88rem; }

    .forgot-password-link {
      color: var(--lp-brand);
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
    }
    .forgot-password-link:hover { text-decoration: underline; }
    .forgot-password-link--strong { font-weight: 700; }
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
