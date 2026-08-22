import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { sanitizeReturnUrl } from '../../core/auth/return-url';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';

/**
 * Login form (spec: frontend-auth-session; return-URL preservation). Delegates
 * to {@link AuthStore.login} and navigates away from `/login` once the store
 * reports `isAuthenticated()`. If a `returnUrl` query param is present and
 * passes {@link sanitizeReturnUrl}'s open-redirect allow-list (design D4), it
 * navigates there; otherwise it falls back to `''` (design D4/Home route).
 * UI copy is Spanish per the existing `admin-users.component.ts` convention;
 * code/comments stay in English. Visual layer uses the FlowPilot shared/ui
 * kit (fp-card/fp-input/fp-button) — behavior is unchanged from the raw-HTML
 * version this replaces.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent, FpInputComponent, RouterLink],
  template: `
    <div class="login-page">
      <fp-card class="login-card">
        <form class="login-form" (submit)="onSubmit($event)">
          <h1 class="login-title">Iniciar sesión</h1>
          @if (error(); as message) {
            <p data-testid="login-error" class="login-error">{{ message }}</p>
          }
          <fp-input
            label="Email"
            type="email"
            testId="login-email"
            [value]="email()"
            [required]="true"
            (valueChange)="email.set($event)"
          />
          <fp-input
            label="Contraseña"
            type="password"
            testId="login-password"
            [value]="password()"
            [required]="true"
            (valueChange)="password.set($event)"
          />
          <fp-button type="submit" testId="login-submit" [disabled]="submitting()">
            Ingresar
          </fp-button>
          <div class="login-links">
            <a routerLink="/register">¿No tenés cuenta? Registrate</a>
            <a routerLink="/forgot-password">¿Olvidaste tu contraseña?</a>
          </div>
        </form>
      </fp-card>
    </div>
  `,
  styles: `
    .login-page {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--fp-space-8);
      background: var(--fp-bg);
    }

    .login-card {
      width: 100%;
      max-width: 360px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .login-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .login-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .login-links {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
    }

    .login-links a {
      color: var(--fp-accent);
    }
  `,
})
export class LoginComponent {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);

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
