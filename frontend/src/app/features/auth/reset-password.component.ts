import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';

interface ProblemDetailLike {
  error?: { detail?: string; errors?: Record<string, string> };
}

/**
 * Password-reset form (backend: `POST /api/auth/reset-password`). Reads the
 * reset `token` from the `token` query param the same way {@link LoginComponent}
 * reads `returnUrl` — via `route.snapshot.queryParamMap`. A missing token is
 * a client-side error (no point calling the API); an unknown/expired/used
 * token surfaces the backend's RFC7807 detail.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent, FpInputComponent],
  template: `
    <div class="reset-password-page">
      <fp-card class="reset-password-card">
        <form class="reset-password-form" (submit)="onSubmit($event)">
          <h1 class="reset-password-title">Restablecer contraseña</h1>
          @if (error(); as message) {
            <p data-testid="reset-password-error" class="reset-password-error">{{ message }}</p>
          }
          <fp-input
            label="Nueva contraseña"
            type="password"
            testId="reset-password-new-password"
            [value]="newPassword()"
            [required]="true"
            [error]="newPasswordError()"
            (valueChange)="newPassword.set($event)"
          />
          <fp-button type="submit" testId="reset-password-submit" [disabled]="submitting()">
            Restablecer contraseña
          </fp-button>
        </form>
      </fp-card>
    </div>
  `,
  styles: `
    .reset-password-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--fp-space-8);
      background: var(--fp-bg);
    }

    .reset-password-card {
      width: 100%;
      max-width: 360px;
    }

    .reset-password-form {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .reset-password-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .reset-password-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }
  `,
})
export class ResetPasswordComponent {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly newPassword = signal('');
  readonly submitting = signal(false);
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
