import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpIconComponent } from '../../../shared/ui/icon.component';

/**
 * Public landing hero: headline + primary CTAs on the left, a decorative
 * "workspace active" quick-actions card on the right. The card's rows and the
 * uptime stats are static portfolio dressing, not wired to data. Carries the
 * `home-*` test hooks the route contract expects (welcome panel, quick
 * actions, and a projects link reading "Mis proyectos").
 *
 * Split out of the old single-file landing so each stylesheet stays under the
 * `anyComponentStyle` budget. Shared `.lp-*` primitives (buttons, eyebrows,
 * dots) live in `styles.scss` scoped to `.lp`.
 */
@Component({
  selector: 'app-landing-hero',
  standalone: true,
  imports: [RouterLink, FpIconComponent],
  template: `
    <section class="lp-hero" data-testid="home-welcome-panel" aria-labelledby="home-title">
      <div class="lp-hero__copy">
        <p class="lp-eyebrow"><span class="lp-dot lp-dot--brand"></span> Espacio de trabajo inteligente</p>
        <h1 id="home-title" class="lp-hero__title">Bienvenido a <span class="lp-accent">FlowPilot</span></h1>
        <p class="lp-hero__lead">Gestiona tus proyectos y flujos de trabajo desde un solo lugar.</p>
        <p class="lp-hero__desc">
          Retomá el control de tu trabajo diario con una vista clara, dinámica y colaborativa
          de lo que verdaderamente importa ahora.
        </p>
        <div class="lp-hero__cta">
          <a routerLink="/projects" class="lp-btn lp-btn--primary"><fp-icon name="folder" /> Explorar proyectos</a>
          <a routerLink="/projects" class="lp-btn lp-btn--ghost">Ver tablero en vivo <span aria-hidden="true">→</span></a>
        </div>
        <ul class="lp-hero__stats">
          <li><span class="lp-dot lp-dot--green"></span> 99.9% uptime</li>
          <li>Tableros ilimitados</li>
          <li>Sincronización instantánea</li>
        </ul>
      </div>

      <aside class="lp-card" data-testid="home-quick-actions" aria-labelledby="home-actions-title">
        <div class="lp-card__head">
          <p class="lp-eyebrow lp-eyebrow--sm"><span class="lp-dot lp-dot--brand"></span> Espacio de trabajo activo</p>
          <span class="lp-badge">Online</span>
        </div>
        <h2 id="home-actions-title">Accesos rápidos</h2>
        <p class="lp-card__sub">Atajos directos para continuar tu sprint de trabajo.</p>
        <a routerLink="/projects" data-testid="home-projects-link" class="lp-quick lp-quick--primary">
          <span class="lp-quick__label"><fp-icon name="folder" /> Mis proyectos</span>
          <span class="lp-quick__meta">14 tareas</span>
        </a>
        <a routerLink="/profile" class="lp-quick">
          <span class="lp-quick__label"><fp-icon name="user" /> Revisar mi perfil</span>
          <span aria-hidden="true" class="lp-quick__chevron">›</span>
        </a>
        <a routerLink="/projects" class="lp-quick">
          <span class="lp-quick__label"><fp-icon name="board" /> Sprint activo: Q3 Release</span>
          <span class="lp-quick__meta">Ver →</span>
        </a>
        <div class="lp-card__foot">
          <span><span class="lp-dot lp-dot--green"></span> Última sincronización: hace 2 min</span>
          <span>Configurar</span>
        </div>
      </aside>
    </section>
  `,
  styles: `
    .lp-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
      gap: clamp(1.5rem, 4vw, 3rem);
      align-items: start;
      padding: clamp(1.75rem, 4vw, 3rem);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      background: linear-gradient(135deg, var(--lp-brand-soft), var(--lp-ground) 60%);
    }
    .lp-hero__title { margin: 0; font-size: clamp(2.1rem, 5vw, 3.1rem); font-weight: 800; letter-spacing: -0.02em; }
    .lp-hero__lead { margin: 1rem 0 0; font-size: clamp(1.05rem, 2vw, 1.2rem); font-weight: 600; }
    .lp-hero__desc { margin: 0.75rem 0 0; max-width: 34rem; color: var(--lp-muted); line-height: 1.6; }

    .lp-hero__cta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
    .lp-hero__stats {
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      margin: 1.5rem 0 0;
      padding: 0;
      list-style: none;
      font-size: 0.85rem;
      color: var(--lp-muted);
    }
    .lp-hero__stats li { display: flex; align-items: center; gap: 0.4rem; }

    .lp-card {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1.5rem;
      background: var(--lp-surface);
      border: 1px solid var(--lp-line);
      border-radius: 16px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
    }
    .lp-card__head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .lp-card h2 { margin: 0.5rem 0 0; font-size: 1.15rem; font-weight: 700; }
    .lp-card__sub { color: var(--lp-muted); font-size: 0.82rem; }
    .lp-badge {
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      font-size: 0.7rem;
      font-weight: 700;
    }

    .lp-quick {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.7rem 0.85rem;
      border-radius: 10px;
      border: 1px solid var(--lp-line);
      background: var(--lp-surface);
      color: var(--lp-ink);
      font-size: 0.85rem;
      font-weight: 600;
    }
    .lp-quick__label { display: inline-flex; align-items: center; gap: 0.5rem; }
    .lp-quick__meta { color: var(--lp-muted); font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
    .lp-quick__chevron { color: #94a3b8; }
    .lp-quick:hover { border-color: var(--lp-brand); }
    .lp-quick--primary { background: var(--lp-brand); border-color: var(--lp-brand); color: #fff; }
    .lp-quick--primary .lp-quick__meta { color: rgba(255, 255, 255, 0.85); }
    .lp-quick--primary:hover { background: var(--lp-brand-hover); }
    .lp-card__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-top: 0.4rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--lp-line);
      font-size: 0.72rem;
      color: var(--lp-muted);
    }
    .lp-card__foot span:first-child { display: inline-flex; align-items: center; gap: 0.4rem; }

    @media (max-width: 860px) {
      .lp-hero { grid-template-columns: 1fr; }
    }
  `,
})
export class LandingHeroComponent {}
