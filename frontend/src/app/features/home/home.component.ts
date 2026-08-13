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
 * security boundary, not this ad hoc link. Visual layer uses the FlowPilot
 * shared/ui kit (fp-button, styled with routerLink so it still renders an
 * `<a>`) — behavior is unchanged from the raw-HTML version this replaces.
 * Heading copy is a welcome line rather than a repeated "FlowPilot" logo:
 * the root app shell's nav bar already carries the brand.
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
      <h1 class="home-title">Bienvenido a FlowPilot</h1>
      <p class="home-subtitle">Gestiona tus proyectos y tareas desde un solo lugar.</p>
      <a routerLink="/projects" data-testid="home-projects-link" class="home-projects-link"
        >Mis proyectos</a
      >
    </div>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--fp-space-4);
      padding: var(--fp-space-8);
    }

    .home-notice {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-warning);
    }

    .home-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 2rem;
      color: var(--fp-text);
    }

    .home-subtitle {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 1rem;
      color: var(--fp-text-muted);
    }

    .home-projects-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--fp-space-2);
      padding: var(--fp-space-2) var(--fp-space-4);
      border-radius: var(--fp-radius-sm);
      border: 1px solid transparent;
      background: var(--fp-accent);
      color: var(--fp-accent-contrast);
      font-family: var(--fp-font-body);
      font-weight: 600;
      font-size: 0.9375rem;
      line-height: 1.25;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }

    .home-projects-link:hover {
      background: var(--fp-accent-hover);
    }

    .home-projects-link:focus-visible {
      outline: 2px solid var(--fp-focus);
      outline-offset: 2px;
    }
  `,
})
export class HomeComponent {
  private readonly accessNotice = inject(AccessNoticeStore);

  readonly notice = signal(this.accessNotice.consume());
}
