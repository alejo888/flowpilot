import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';

/**
 * Password-reset request form (backend: `POST /api/auth/forgot-password`).
 * The endpoint always resolves with 200 regardless of whether the account
 * exists (no account enumeration, design decision on the backend side), so
 * this component shows the same generic confirmation on any successful
 * response and never distinguishes "email not found" from "email sent".
 * A genuine request failure (network/5xx) shows a separate generic error.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent, FpInputComponent, RouterLink],
  template: `
    <div class="forgot-password-page">
      <fp-card class="forgot-password-card">
        @if (submitted()) {
          <p data-testid="forgot-password-success" class="forgot-password-success">
            Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.
          </p>
          <div class="forgot-password-links">
            <a routerLink="/login">Volver a iniciar sesión</a>
          </div>
        } @else {
          <form class="forgot-password-form" (submit)="onSubmit($event)">
            <h1 class="forgot-password-title">Recuperar contraseña</h1>
            @if (error(); as message) {
              <p data-testid="forgot-password-error" class="forgot-password-error">{{ message }}</p>
            }
            <fp-input
              label="Email"
              type="email"
              testId="forgot-password-email"
              [value]="email()"
              [required]="true"
              (valueChange)="email.set($event)"
            />
            <fp-button type="submit" icon="external-link" testId="forgot-password-submit" [disabled]="submitting()">
              Enviar enlace
            </fp-button>
            <div class="forgot-password-links">
              <a routerLink="/login">Volver a iniciar sesión</a>
            </div>
          </form>
        }
      </fp-card>
    </div>
  `,
  styles: `
    .forgot-password-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--fp-space-8);
      background: var(--fp-bg);
    }

    .forgot-password-card {
      width: 100%;
      max-width: 360px;
    }

    .forgot-password-form {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .forgot-password-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .forgot-password-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .forgot-password-success {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
    }

    .forgot-password-links {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      margin-top: var(--fp-space-4);
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
    }

    .forgot-password-links a {
      color: var(--fp-accent);
    }
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
