import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';

interface ProblemDetailLike {
  error?: { detail?: string; errors?: Record<string, string> };
}

/**
 * Self-service registration form (backend: `POST /api/auth/register`).
 * Registration has no session side effects — the response carries no
 * tokens — so this component owns its own `submitting`/`error` signals
 * instead of delegating to {@link AuthStore}, and simply navigates to
 * `/login` on success. Mirrors {@link LoginComponent}'s form/error/testId
 * conventions.
 *
 * Backend validation errors arrive as an RFC7807 `errors` map keyed by field
 * name (`GlobalExceptionHandler.handleValidation`). Each entry is routed to its
 * own `fp-input`'s `[error]` slot so the user can see *which* field is wrong;
 * the top-level banner is reserved for errors with no field attribution (409
 * duplicate email, network/5xx).
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent, FpInputComponent, RouterLink],
  template: `
    <div class="register-page">
      <fp-card class="register-card">
        <form class="register-form" (submit)="onSubmit($event)">
          <h1 class="register-title">Crear cuenta</h1>
          @if (error(); as message) {
            <p data-testid="register-error" class="register-error">{{ message }}</p>
          }
          <fp-input
            label="Nombre"
            testId="register-name"
            [value]="name()"
            [required]="true"
            [error]="nameError()"
            (valueChange)="name.set($event)"
          />
          <fp-input
            label="Email"
            type="email"
            testId="register-email"
            [value]="email()"
            [required]="true"
            [error]="emailError()"
            (valueChange)="email.set($event)"
          />
          <fp-input
            label="Contraseña"
            type="password"
            testId="register-password"
            [value]="password()"
            [required]="true"
            [error]="passwordError()"
            (valueChange)="password.set($event)"
          />
          <fp-button type="submit" icon="add" testId="register-submit" [disabled]="submitting()">
            Crear cuenta
          </fp-button>
          <div class="register-links">
            <a routerLink="/login">¿Ya tenés cuenta? Iniciá sesión</a>
          </div>
        </form>
      </fp-card>
    </div>
  `,
  styles: `
    .register-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--fp-space-8);
      background: var(--fp-bg);
    }

    .register-card {
      width: 100%;
      max-width: 360px;
    }

    .register-form {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .register-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .register-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .register-links {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
    }

    .register-links a {
      color: var(--fp-accent);
    }
  `,
})
export class RegisterComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly nameError = computed(() => this.fieldErrors()['name'] ?? null);
  readonly emailError = computed(() => this.fieldErrors()['email'] ?? null);
  readonly passwordError = computed(() => this.fieldErrors()['password'] ?? null);

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
