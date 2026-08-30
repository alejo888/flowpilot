import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AiConfigService } from './core/ai/ai-config.service';
import { AuthStore } from './core/auth/auth.store';
import { decodeEmail } from './core/auth/jwt-claims';
import { FpButtonComponent } from './shared/ui/button.component';
import { FpIconComponent } from './shared/ui/icon.component';

/**
 * Root app shell: fixed sidebar (spec: app-shell-navigation; design D4) at
 * desktop widths, collapsing to a top bar + off-canvas drawer below the
 * breakpoint. Nav links are gated on {@link AuthStore.isAuthenticated}/`isAdmin`
 * so unauthenticated visitors (e.g. on `/login`) never see links to guarded
 * routes. `drawerOpen` (formerly `navOpen`) controls the mobile drawer only —
 * desktop always shows the sidebar.
 */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FpButtonComponent, FpIconComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly aiConfig = inject(AiConfigService);

  protected readonly drawerOpen = signal(false);

  constructor() {
    // Refresh AI availability whenever the session becomes authenticated
    // (bootstrap re-hydration or a fresh login). AiConfigService is fail-closed
    // and de-dupes concurrent calls, so re-running this is safe.
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        this.aiConfig.load();
      }
    });
  }

  /** Decoded from the in-memory access token (backend `JwtService` sets the `email` claim). */
  protected readonly currentUserEmail = computed(() => decodeEmail(this.authStore.accessToken()));

  /** Single uppercase initial for the sidebar avatar, derived from the email local part. */
  protected readonly currentUserInitial = computed(() => {
    const email = this.currentUserEmail();
    return email ? email.charAt(0).toUpperCase() : '?';
  });

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  onLogout(): void {
    this.closeDrawer();
    this.authStore.logout();
    this.router.navigateByUrl('/login');
  }
}
