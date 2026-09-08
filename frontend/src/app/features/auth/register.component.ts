import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpIconComponent } from '../../shared/ui/icon.component';

interface ProblemDetailLike {
  error?: { detail?: string; errors?: Record<string, string> };
}

/** The backend's only password rule (`@Size(min = ...)` in `RegisterRequest`). */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Self-service registration form (backend: `POST /api/auth/register`).
 * Registration has no session side effects — the response carries no
 * tokens — so this component owns its own `submitting`/`error` signals
 * instead of delegating to {@link AuthStore}, and simply navigates to
 * `/login` on success.
 *
 * Visual layer mirrors {@link LoginComponent}: a bespoke card in the redesign
 * scale (blue/slate `--lp-*`) with icon-prefixed fields and a password reveal
 * toggle. The shared fp-input/fp-button kit doesn't carry those affordances.
 * Social sign-up, a "14-day trial / no credit card" line, an "email
 * corporativo" restriction and a terms-of-service checkbox from the mock are
 * intentionally left out: there is no OAuth backend, no billing/trial, the
 * backend only checks email *format*, and there are no terms/privacy pages.
 *
 * Backend validation errors arrive as an RFC7807 `errors` map keyed by field
 * name (`GlobalExceptionHandler.handleValidation`). Each entry is routed to its
 * own field so the user can see *which* field is wrong; the top-level banner is
 * reserved for errors with no field attribution (409 duplicate email,
 * network/5xx). The `register-name` / `register-email` / `register-password` /
 * `register-error` / `register-submit` test hooks are unchanged.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="register-page auth-page">
      <div class="register-shell">
        <p class="register-eyebrow"><span class="register-eyebrow__dot"></span> Creá tu espacio de trabajo</p>

        <div class="register-card">
          <header class="register-card__head">
            <h1 class="register-card__title">Crear cuenta</h1>
            <p class="register-card__subtitle">
              Creá tu cuenta gratuita para empezar a gestionar tus proyectos en FlowPilot.
            </p>
          </header>

          <form class="register-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="register-error" class="register-form__error" role="alert">{{ message }}</p>
            }

            <label class="register-field">
              <span class="register-field__label">Nombre completo</span>
              <span
                class="register-field__control"
                [class.register-field__control--invalid]="nameError()"
              >
                <fp-icon name="user" class="register-field__icon" />
                <input
                  #nameInput
                  data-testid="register-name"
                  type="text"
                  autocomplete="name"
                  required
                  placeholder="Ej. Alex Rossi"
                  [value]="name()"
                  (input)="name.set(nameInput.value)"
                />
              </span>
              @if (nameError(); as message) {
                <span class="register-field__error">{{ message }}</span>
              }
            </label>

            <label class="register-field">
              <span class="register-field__label">Email</span>
              <span
                class="register-field__control"
                [class.register-field__control--invalid]="emailError()"
              >
                <fp-icon name="mail" class="register-field__icon" />
                <input
                  #emailInput
                  data-testid="register-email"
                  type="email"
                  autocomplete="email"
                  required
                  placeholder="usuario@flowpilot.io"
                  [value]="email()"
                  (input)="email.set(emailInput.value)"
                />
              </span>
              @if (emailError(); as message) {
                <span class="register-field__error">{{ message }}</span>
              }
            </label>

            <label class="register-field">
              <span class="register-field__label">Contraseña</span>
              <span
                class="register-field__control"
                [class.register-field__control--invalid]="passwordError()"
              >
                <fp-icon name="lock" class="register-field__icon" />
                <input
                  #passwordInput
                  data-testid="register-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  [placeholder]="'Mínimo ' + minPasswordLength + ' caracteres'"
                  [value]="password()"
                  (input)="password.set(passwordInput.value)"
                />
                <button
                  type="button"
                  class="register-field__toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <fp-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </span>
              @if (passwordError(); as message) {
                <span class="register-field__error">{{ message }}</span>
              }
              <span
                class="register-field__hint"
                [class.register-field__hint--ok]="passwordLongEnough()"
              >
                <fp-icon name="check" class="register-field__hint-icon" /> Mínimo
                {{ minPasswordLength }} caracteres
              </span>
            </label>

            <button
              type="submit"
              class="register-submit"
              data-testid="register-submit"
              [disabled]="submitting()"
            >
              <fp-icon name="add" /> Crear cuenta gratuita
            </button>
          </form>

          <hr class="register-card__rule" />
          <p class="register-card__foot">
            ¿Ya tenés cuenta?
            <a routerLink="/login" class="register-link register-link--strong">Iniciar sesión</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* ground + blueprint grid are painted on <body> (styles.scss,
       body:has(.register-page)) so they cover the whole viewport */
    .register-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1.5rem, 6vw, 4rem) 1rem;
    }

    .register-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 480px;
    }

    .register-eyebrow {
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
    .register-eyebrow__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--lp-brand); }

    .register-card {
      width: 100%;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      background: var(--lp-surface);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    }

    .register-card__head { text-align: center; margin-bottom: 1.5rem; }
    .register-card__title { margin: 0; font-family: var(--fp-font-body); font-size: 1.6rem; font-weight: 800; color: var(--lp-ink); }
    .register-card__subtitle { margin: 0.5rem auto 0; max-width: 34ch; color: var(--lp-muted); font-size: 0.9rem; line-height: 1.5; }

    .register-form { display: flex; flex-direction: column; gap: 1rem; }

    .register-form__error {
      margin: 0;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      background: #fef2f2;
      color: var(--fp-danger);
      font-size: 0.85rem;
    }

    .register-field { display: flex; flex-direction: column; gap: 0.4rem; }
    .register-field__label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--lp-muted);
    }
    .register-field__control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--lp-line);
      border-radius: 12px;
      background: var(--lp-surface);
    }
    .register-field__control:focus-within { border-color: var(--lp-brand); box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12); }
    .register-field__control--invalid { border-color: var(--fp-danger); }
    .register-field__control input {
      flex: 1;
      min-width: 0;
      padding: 0.7rem 0;
      border: 0;
      background: transparent;
      font-family: var(--fp-font-body);
      font-size: 0.95rem;
      color: var(--lp-ink);
    }
    .register-field__control input:focus { outline: none; }
    /* keep the field white under browser autofill, and drop the native
       password-reveal so only our toggle shows */
    .register-field__control input:-webkit-autofill,
    .register-field__control input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 100px var(--lp-surface) inset;
      -webkit-text-fill-color: var(--lp-ink);
    }
    .register-field__control input::-ms-reveal,
    .register-field__control input::-ms-clear { display: none; }
    .register-field__icon { color: #94a3b8; flex: 0 0 auto; }

    .register-field__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      border: 0;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
    }
    .register-field__toggle:hover { color: var(--lp-brand); }
    .register-field__toggle:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; border-radius: 6px; }

    .register-field__error { color: var(--fp-danger); font-size: 0.8rem; }

    .register-field__hint {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--lp-muted);
      font-size: 0.78rem;
    }
    .register-field__hint-icon { width: 0.9rem; height: 0.9rem; color: #cbd5e1; }
    .register-field__hint--ok { color: var(--fp-success, #16a34a); }
    .register-field__hint--ok .register-field__hint-icon { color: currentColor; }

    .register-submit {
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
    .register-submit:hover:not(:disabled) { background: var(--lp-brand-hover); }
    .register-submit:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; }
    .register-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .register-card__rule { margin: 1.5rem 0 1rem; border: 0; border-top: 1px solid var(--lp-line); }
    .register-card__foot { margin: 0; text-align: center; color: var(--lp-muted); font-size: 0.88rem; }

    .register-link { color: var(--lp-brand); font-size: 0.85rem; font-weight: 600; text-decoration: none; }
    .register-link:hover { text-decoration: underline; }
    .register-link--strong { font-weight: 700; }

    fp-icon .fp-icon { width: 1.05rem; height: 1.05rem; }
    .register-submit .fp-icon { width: 1rem; height: 1rem; }
  `,
})
export class RegisterComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly nameError = computed(() => this.fieldErrors()['name'] ?? null);
  readonly emailError = computed(() => this.fieldErrors()['email'] ?? null);
  readonly passwordError = computed(() => this.fieldErrors()['password'] ?? null);
  /** Live echo of the backend's only password rule. */
  readonly passwordLongEnough = computed(() => this.password().length >= MIN_PASSWORD_LENGTH);

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitting.set(true);
    this.error.set(null);
    this.fieldErrors.set({});

    this.api
      .register({ name: this.name(), email: this.email(), password: this.password() })
      .subscribe({
        next: () => this.router.navigateByUrl('/login'),
        error: (err: unknown) => {
          this.submitting.set(false);
          this.applyError(err);
        },
      });
  }

  /**
   * Field-attributed validation errors go to their own input; anything else
   * (409 duplicate email, network/5xx) stays in the top-level banner.
   */
  private applyError(err: unknown): void {
    const problem = err as ProblemDetailLike;
    const fieldErrors = problem?.error?.errors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      this.fieldErrors.set({ ...fieldErrors });
      const unattributed = Object.entries(fieldErrors)
        .filter(([field]) => !['name', 'email', 'password'].includes(field))
        .map(([, message]) => message);
      this.error.set(unattributed.length > 0 ? unattributed.join(' ') : null);
      return;
    }
    this.error.set(problem?.error?.detail ?? 'No se pudo crear la cuenta');
  }
}
