import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';

/**
 * Login form (spec: frontend-auth-session). Delegates to {@link AuthStore.login}
 * and navigates away from `/login` once the store reports `isAuthenticated()`.
 * `router.navigate(['/'])` is the accepted redirect target per design's Open
 * Question — no route is registered at `''` yet, so the landing page is
 * currently blank until a future route-guard/home slice (expected, accepted
 * gap, not a bug in this component). UI copy is Spanish per the existing
 * `admin-users.component.ts` convention; code/comments stay in English.
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

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);

  readonly error = this.store.error;

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) {
        this.router.navigate(['/']);
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
