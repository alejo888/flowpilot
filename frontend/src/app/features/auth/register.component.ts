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
 * Visual layer uses the shared `.auth-*` card primitives (styles.scss) that
 * login / forgot-password / reset-password also render — icon-prefixed fields
 * and a password reveal toggle the shared fp-input/fp-button kit doesn't
 * carry. Social sign-up, a "14-day trial / no credit card" line, an "email
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
    <div class="auth-page">
      <div class="auth-shell">
        <p class="auth-eyebrow"><span class="auth-eyebrow__dot"></span> Creá tu espacio de trabajo</p>

        <div class="auth-card">
          <header class="auth-card__head">
            <h1 class="auth-card__title">Crear cuenta</h1>
            <p class="auth-card__subtitle">
              Creá tu cuenta gratuita para empezar a gestionar tus proyectos en FlowPilot.
            </p>
          </header>

          <form class="auth-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="register-error" class="auth-form__error" role="alert">{{ message }}</p>
            }

            <label class="auth-field">
              <span class="auth-field__label">Nombre completo</span>
              <span
                class="auth-field__control"
                [class.auth-field__control--invalid]="nameError()"
              >
                <fp-icon name="user" class="auth-field__icon" />
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
                <span class="auth-field__error">{{ message }}</span>
              }
            </label>

            <label class="auth-field">
              <span class="auth-field__label">Email</span>
              <span
                class="auth-field__control"
                [class.auth-field__control--invalid]="emailError()"
              >
                <fp-icon name="mail" class="auth-field__icon" />
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
                <span class="auth-field__error">{{ message }}</span>
              }
            </label>

            <label class="auth-field">
              <span class="auth-field__label">Contraseña</span>
              <span
                class="auth-field__control"
                [class.auth-field__control--invalid]="passwordError()"
              >
                <fp-icon name="lock" class="auth-field__icon" />
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
                  class="auth-field__toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <fp-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </span>
              @if (passwordError(); as message) {
                <span class="auth-field__error">{{ message }}</span>
              }
              <span
                class="auth-field__hint"
                [class.auth-field__hint--ok]="passwordLongEnough()"
              >
                <fp-icon name="check" class="auth-field__hint-icon" /> Mínimo
                {{ minPasswordLength }} caracteres
              </span>
            </label>

            <button
              type="submit"
              class="auth-submit"
              data-testid="register-submit"
              [disabled]="submitting()"
            >
              <fp-icon name="add" /> Crear cuenta gratuita
            </button>
          </form>

          <hr class="auth-card__rule" />
          <p class="auth-card__foot">
            ¿Ya tenés cuenta?
            <a routerLink="/login" class="auth-link auth-link--strong">Iniciar sesión</a>
          </p>
        </div>
      </div>
    </div>
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
