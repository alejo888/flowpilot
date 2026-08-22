import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccessNoticeStore } from '../../core/notifications/access-notice.store';
import { FpIconComponent } from '../../shared/ui/icon.component';

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
  imports: [RouterLink, FpIconComponent],
  template: `
    <div class="home">
      @if (notice(); as message) {
        <p data-testid="home-notice" class="home-notice">{{ message }}</p>
      }
      <section class="home-welcome-panel" data-testid="home-welcome-panel" aria-labelledby="home-title">
        <div class="home-welcome-copy">
          <p class="home-eyebrow">Espacio de trabajo</p>
          <h1 id="home-title" class="home-title">Bienvenido a FlowPilot</h1>
          <p class="home-subtitle">Gestiona tus proyectos y tareas desde un solo lugar.</p>
          <p class="home-description">Retomá el control de tu trabajo con una vista clara de lo que importa ahora.</p>
        </div>
        <div class="home-quick-actions" data-testid="home-quick-actions" aria-labelledby="home-actions-title">
          <h2 id="home-actions-title">Accesos rápidos</h2>
          <a routerLink="/projects" data-testid="home-projects-link" class="home-projects-link"><fp-icon name="folder" /> Mis proyectos</a>
          <a routerLink="/profile" class="home-secondary-link">Revisar mi perfil <span aria-hidden="true">→</span></a>
        </div>
      </section>
    </div>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-6);
      max-width: 1120px;
      margin: 0 auto;
      padding: clamp(var(--fp-space-6), 6vw, var(--fp-space-12)) clamp(var(--fp-space-4), 4vw, var(--fp-space-8));
    }

    .home-welcome-panel {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
      gap: var(--fp-space-8);
      align-items: stretch;
      padding: clamp(var(--fp-space-6), 5vw, var(--fp-space-12));
      border: 1px solid var(--fp-border);
      border-radius: var(--fp-radius-lg);
      background: linear-gradient(135deg, var(--fp-surface), color-mix(in srgb, var(--fp-accent) 7%, var(--fp-surface)));
      box-shadow: var(--fp-shadow-md);
    }

    .home-welcome-copy { align-self: center; max-width: 38rem; }

    .home-eyebrow {
      margin: 0 0 var(--fp-space-3);
      color: var(--fp-accent);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
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
      font-size: clamp(1.05rem, 2vw, 1.25rem);
      line-height: 1.5;
      color: var(--fp-text);
    }

    .home-description { max-width: 34rem; margin: var(--fp-space-4) 0 0; color: var(--fp-text-muted); line-height: 1.6; }

    .home-quick-actions {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--fp-space-3);
      padding: var(--fp-space-6);
      border-left: 1px solid var(--fp-border);
    }

    .home-quick-actions h2 { margin: 0 0 var(--fp-space-2); font-family: var(--fp-font-display); font-size: 1.25rem; color: var(--fp-text); }

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

    .home-projects-link:focus-visible,
    .home-secondary-link:focus-visible { outline: 2px solid var(--fp-focus); outline-offset: 2px; }

    .home-secondary-link { display: inline-flex; justify-content: space-between; gap: var(--fp-space-3); color: var(--fp-accent); font-weight: 600; text-decoration: none; }

    @media (max-width: 700px) {
      .home-welcome-panel { grid-template-columns: 1fr; gap: var(--fp-space-6); }
      .home-quick-actions { border-left: 0; border-top: 1px solid var(--fp-border); padding: var(--fp-space-6) 0 0; }
    }
  `,
})
export class HomeComponent {
  private readonly accessNotice = inject(AccessNoticeStore);

  readonly notice = signal(this.accessNotice.consume());
}
