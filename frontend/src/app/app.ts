import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from './core/auth/auth.store';
import { FpButtonComponent } from './shared/ui/button.component';

/**
 * Root app shell: top nav (brand + section links + logout) and a
 * max-width, centered content region wrapping the router outlet. Nav links
 * are gated on {@link AuthStore.isAuthenticated}/`isAdmin` so unauthenticated
 * visitors (e.g. on `/login`) never see links to guarded routes. Below the
 * `app.scss` collapse breakpoint, the links + logout button hide behind a
 * toggle (`navOpen`) instead of wrapping onto extra rows.
 */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, FpButtonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly navOpen = signal(false);

  toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  closeNav(): void {
    this.navOpen.set(false);
  }

  onLogout(): void {
    this.closeNav();
    this.authStore.logout();
    this.router.navigateByUrl('/login');
  }
}
