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
 * Visual layer mirrors {@link ForgotPasswordComponent} / {@link LoginComponent}:
 * a bespoke card in the blue/slate `--lp-*` scale with an icon-prefixed field,
 * a password reveal toggle and the blueprint-grid background. Behaviour, the
 * field-error routing and the `reset-password-*` test hooks are unchanged.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FpIconComponent, RouterLink],
  template: `
    <div class="reset-password-page auth-page">
      <div class="reset-password-shell">
        <p class="reset-password-eyebrow">
          <span class="reset-password-eyebrow__dot"></span> Recuperación segura
        </p>

        <div class="reset-password-card">
          <span class="reset-password-card__badge" aria-hidden="true">
            <fp-icon name="key" />
          </span>
          <header class="reset-password-card__head">
            <h1 class="reset-password-card__title">Restablecer contraseña</h1>
            <p class="reset-password-card__subtitle">
              Elegí una nueva contraseña para tu cuenta de FlowPilot.
            </p>
          </header>

          <form class="reset-password-form" (submit)="onSubmit($event)">
            @if (error(); as message) {
              <p data-testid="reset-password-error" class="reset-password-form__error" role="alert">
                {{ message }}
              </p>
            }

            <label class="reset-password-field">
              <span class="reset-password-field__label">Nueva contraseña</span>
              <span
                class="reset-password-field__control"
                [class.reset-password-field__control--invalid]="newPasswordError()"
              >
                <fp-icon name="lock" class="reset-password-field__icon" />
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
                  class="reset-password-field__toggle"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  [attr.aria-pressed]="showPassword()"
                  (click)="showPassword.set(!showPassword())"
                >
                  <fp-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </span>
              @if (newPasswordError(); as message) {
                <span class="reset-password-field__error">{{ message }}</span>
              }
              <span class="reset-password-field__hint">Mínimo 8 caracteres</span>
            </label>

            <button
              type="submit"
              class="reset-password-submit"
              data-testid="reset-password-submit"
              [disabled]="submitting()"
            >
              <fp-icon name="key" /> Restablecer contraseña
            </button>
          </form>

          <hr class="reset-password-card__rule" />
          <p class="reset-password-card__foot">
            <a routerLink="/login" class="reset-password-link reset-password-link--strong">
              <span aria-hidden="true">←</span> Volver a iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    /* ground + blueprint grid are painted on <body> (styles.scss,
       body:has(.reset-password-page)) so they cover the whole viewport */
    .reset-password-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1.5rem, 6vw, 4rem) 1rem;
    }

    .reset-password-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      width: 100%;
      max-width: 460px;
    }

    .reset-password-eyebrow {
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
    .reset-password-eyebrow__dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--lp-brand);
    }

    .reset-password-card {
      width: 100%;
      padding: clamp(1.5rem, 5vw, 2.5rem);
      background: var(--lp-surface);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
      text-align: center;
    }

    .reset-password-card__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 14px;
      background: var(--lp-brand-soft);
      color: var(--lp-brand);
    }
    .reset-password-card__badge .fp-icon { width: 1.4rem; height: 1.4rem; }

    .reset-password-card__head { margin: 1rem 0 1.5rem; }
    .reset-password-card__title {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--lp-ink);
    }
    .reset-password-card__subtitle {
      margin: 0.5rem auto 0;
      max-width: 40ch;
      color: var(--lp-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .reset-password-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; }

    .reset-password-form__error {
      margin: 0;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      background: #fef2f2;
      color: var(--fp-danger);
      font-size: 0.85rem;
    }

    .reset-password-field { display: flex; flex-direction: column; gap: 0.4rem; }
    .reset-password-field__label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--lp-muted);
    }
    .reset-password-field__control {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      border: 1px solid var(--lp-line);
      border-radius: 12px;
      background: var(--lp-surface);
    }
    .reset-password-field__control:focus-within {
      border-color: var(--lp-brand);
      box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
    }
    .reset-password-field__control--invalid { border-color: var(--fp-danger); }
    .reset-password-field__control input {
      flex: 1;
      min-width: 0;
      padding: 0.7rem 0;
      border: 0;
      background: transparent;
      font-family: var(--fp-font-body);
      font-size: 0.95rem;
      color: var(--lp-ink);
    }
    .reset-password-field__control input:focus { outline: none; }
    .reset-password-field__control input:-webkit-autofill,
    .reset-password-field__control input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 100px var(--lp-surface) inset;
      -webkit-text-fill-color: var(--lp-ink);
    }
    .reset-password-field__control input::-ms-reveal,
    .reset-password-field__control input::-ms-clear { display: none; }
    .reset-password-field__icon { color: #94a3b8; flex: 0 0 auto; }

    .reset-password-field__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      border: 0;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
    }
    .reset-password-field__toggle:hover { color: var(--lp-brand); }
    .reset-password-field__toggle:focus-visible {
      outline: 2px solid var(--lp-brand);
      outline-offset: 2px;
      border-radius: 6px;
    }

    .reset-password-field__error { color: var(--fp-danger); font-size: 0.8rem; }
    .reset-password-field__hint { color: var(--lp-muted); font-size: 0.78rem; }

    .reset-password-submit {
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
    .reset-password-submit:hover:not(:disabled) { background: var(--lp-brand-hover); }
    .reset-password-submit:focus-visible { outline: 2px solid var(--lp-brand); outline-offset: 2px; }
    .reset-password-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .reset-password-submit .fp-icon { width: 1rem; height: 1rem; }

    .reset-password-card__rule { margin: 1.5rem 0 1rem; border: 0; border-top: 1px solid var(--lp-line); }
    .reset-password-card__foot { margin: 0; color: var(--lp-muted); font-size: 0.88rem; }

    .reset-password-link {
      color: var(--lp-brand);
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
    }
    .reset-password-link:hover { text-decoration: underline; }
    .reset-password-link--strong { font-weight: 700; }
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
