import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { sanitizeReturnUrl } from '../../core/auth/return-url';

/**
 * Login form (spec: frontend-auth-session; return-URL preservation). Delegates
 * to {@link AuthStore.login} and navigates away from `/login` once the store
 * reports `isAuthenticated()`. If a `returnUrl` query param is present and
 * passes {@link sanitizeReturnUrl}'s open-redirect allow-list (design D4), it
 * navigates there; otherwise it falls back to `''` (design D4/Home route).
 * UI copy is Spanish per the existing `admin-users.component.ts` convention;
 * code/comments stay in English.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <form class="login-form" (submit)="onSubmit($event)">
      <h1>Iniciar sesión</h1>
      @if (error(); as message) {
        <p data-testid="login-error" class="login-error">{{ message }}</p>
      }
      <label>
        Email
        <input
          type="email"
          data-testid="login-email"
          [value]="email()"
          (input)="email.set(inputValue($event))"
          required
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          data-testid="login-password"
          [value]="password()"
          (input)="password.set(inputValue($event))"
          required
        />
      </label>
      <button type="submit" data-testid="login-submit" [disabled]="submitting()">
        Ingresar
      </button>
    </form>
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

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
