import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccessNoticeStore } from '../../core/notifications/access-notice.store';

/**
 * Minimal authenticated landing page (spec: home route). Registered at `''`
 * — the default post-login destination and the fallback target `adminGuard`
 * redirects a denied non-admin user to. Reads and consumes
 * {@link AccessNoticeStore} exactly once on init so a pending "no access"
 * notice renders here and does not survive a reload. Links to `/projects`
 * unconditionally (design D9) — the route's own `authGuard` is the actual
 * security boundary, not this ad hoc link.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home">
      @if (notice(); as message) {
        <p data-testid="home-notice" class="home-notice">{{ message }}</p>
      }
      <h1>FlowPilot</h1>
      <a routerLink="/projects" data-testid="home-projects-link">Mis proyectos</a>
    </div>
  `,
})
export class HomeComponent {
  private readonly accessNotice = inject(AccessNoticeStore);

  readonly notice = signal(this.accessNotice.consume());
}
