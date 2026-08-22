import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { ProfileApiService } from './profile-api.service';
import { UserProfile } from './profile.model';

interface ProblemDetailLike {
  error?: { detail?: string; errors?: Record<string, string> };
}

/**
 * Own-profile screen (spec: profile): read-only name/email from
 * `GET /api/users/me`, plus a change-password form
 * (`PUT /api/users/me/password`). Client-side validation blocks submission
 * the same way `ProjectsComponent`'s create form does (min-length,
 * confirmation match) before ever calling the API; server errors reuse
 * `ResetPasswordComponent`'s field-vs-banner split — a validation `errors`
 * map attributes to its input, anything else (e.g. wrong current password)
 * goes to the top-level banner.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FpButtonComponent, FpCardComponent, FpInputComponent],
  template: `
    <div class="profile">
      <h1 class="profile-title">Perfil</h1>

      @if (loadError(); as message) {
        <p data-testid="profile-load-error" class="profile-error">{{ message }}</p>
      }

      <div class="profile-sections">
        @if (profile(); as user) {
          <fp-card class="profile-card profile-identity-card">
          <dl class="profile-summary">
            <div class="profile-summary-row">
              <dt>Nombre</dt>
              <dd data-testid="profile-name">{{ user.name }}</dd>
            </div>
            <div class="profile-summary-row">
              <dt>Email</dt>
              <dd data-testid="profile-email">{{ user.email }}</dd>
            </div>
          </dl>
        </fp-card>
        }

        <fp-card class="profile-card profile-password-card">
        <form class="profile-password-form" (submit)="onSubmit($event)">
          <h2 class="profile-password-title">Cambiar contraseña</h2>
          @if (formError(); as message) {
            <p data-testid="profile-password-error" class="profile-error">{{ message }}</p>
          }
          @if (successMessage(); as message) {
            <p data-testid="profile-password-success" class="profile-success">{{ message }}</p>
          }
          <fp-input
            label="Contraseña actual"
            type="password"
            testId="profile-current-password"
            [value]="currentPassword()"
            [required]="true"
            [error]="currentPasswordError()"
            (valueChange)="currentPassword.set($event)"
          />
          <fp-input
            label="Nueva contraseña"
            type="password"
            testId="profile-new-password"
            [value]="newPassword()"
            [required]="true"
            [error]="newPasswordError()"
            (valueChange)="newPassword.set($event)"
          />
          <fp-input
            label="Confirmar nueva contraseña"
            type="password"
            testId="profile-confirm-password"
            [value]="confirmPassword()"
            [required]="true"
            [error]="confirmPasswordError()"
            (valueChange)="confirmPassword.set($event)"
          />
          <fp-button type="submit" icon="key" testId="profile-password-submit" [disabled]="submitting()">
            Cambiar contraseña
          </fp-button>
        </form>
        </fp-card>
      </div>
    </div>
  `,
  styles: `
    .profile {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-6);
      max-width: 1120px;
      margin: 0 auto;
      padding: clamp(var(--fp-space-6), 5vw, var(--fp-space-12)) clamp(var(--fp-space-4), 4vw, var(--fp-space-8));
    }

    .profile-sections {
      display: grid;
      grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
      align-items: start;
      gap: var(--fp-space-6);
    }

    @media (max-width: 720px) {
      .profile-sections { grid-template-columns: 1fr; }
    }

    .profile-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .profile-card { width: 100%; }
    .profile-password-card { min-width: 0; }

    .profile-summary {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
      margin: 0;
    }

    .profile-summary-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--fp-space-2);
    }

    .profile-summary-row dt {
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted);
    }

    .profile-summary-row dd {
      margin: 0;
      min-width: 0;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
      overflow-wrap: break-word;
    }

    .profile-password-form {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .profile-password-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-weight: 600;
      font-size: 1.125rem;
      color: var(--fp-text);
    }

    .profile-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .profile-success {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-success);
    }
  `,
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ProfileApiService);

  readonly profile = signal<UserProfile | null>(null);
  readonly loadError = signal<string | null>(null);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly currentPasswordError = computed(() => this.fieldErrors()['currentPassword'] ?? null);
  readonly newPasswordError = computed(() => this.fieldErrors()['newPassword'] ?? null);
  readonly confirmPasswordError = computed(() => this.fieldErrors()['confirmPassword'] ?? null);

  ngOnInit(): void {
    this.api.getCurrentUser().subscribe({
      next: (user) => this.profile.set(user),
      error: () => this.loadError.set('No se pudo cargar el perfil'),
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.formError.set(null);
    this.successMessage.set(null);
    this.fieldErrors.set({});

    const newPassword = this.newPassword();
    const clientErrors: Record<string, string> = {};
    if (newPassword.length < 8) {
      clientErrors['newPassword'] = 'La contraseña debe tener al menos 8 caracteres';
    }
    if (this.confirmPassword() !== newPassword) {
      clientErrors['confirmPassword'] = 'Las contraseñas no coinciden';
    }
    if (Object.keys(clientErrors).length > 0) {
      this.fieldErrors.set(clientErrors);
      return;
    }

    this.submitting.set(true);
    this.api.changePassword({ currentPassword: this.currentPassword(), newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.currentPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.successMessage.set('Contraseña actualizada correctamente');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.applyError(err);
      },
    });
  }

  private applyError(err: unknown): void {
    const problem = err as ProblemDetailLike;
    const fieldErrors = problem?.error?.errors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      this.fieldErrors.set({ ...fieldErrors });
      return;
    }
    this.formError.set(problem?.error?.detail ?? 'No se pudo cambiar la contraseña');
  }
}
