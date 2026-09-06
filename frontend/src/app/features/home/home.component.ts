import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AccessNoticeStore } from '../../core/notifications/access-notice.store';
import { FpIconComponent, FpIconName } from '../../shared/ui/icon.component';

/**
 * Public landing page, registered at `''` — the first screen a logged-out
 * visitor meets and also the default post-login destination / `adminGuard`
 * fallback. Still reads and consumes {@link AccessNoticeStore} exactly once
 * on init so a pending "no access" notice renders here and does not survive a
 * reload, and still links to `/projects` unconditionally (design D9) — the
 * route's own `authGuard` is the real security boundary, not this link.
 *
 * Visual layer is a marketing-style redesign preview: hero + workspace card,
 * a static mock Kanban, three feature pillars, and a dark CTA band. The mock
 * board / stats / sprint row are portfolio decoration, not wired to data.
 *
 * Palette note: this component intentionally overrides the global warm tokens
 * with a local blue/slate scale scoped to `.lp` only, so the rest of the app
 * keeps its current look while we evaluate the redesign. Promoting this scale
 * to `styles.scss` is a separate decision. Required test hooks are preserved:
 * `home-notice`, `home-welcome-panel`, `home-quick-actions`, and a
 * `home-projects-link` that points at `/projects` and reads "Mis proyectos".
 */
interface MockCard {
  tag: string;
  title: string;
  body: string;
}

interface MockColumn {
  name: string;
  cards: MockCard[];
}

interface Pillar {
  icon: FpIconName;
  title: string;
  body: string;
  link: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, FpIconComponent],
  template: `
    <div class="lp">
      @if (notice(); as message) {
        <p data-testid="home-notice" class="lp-notice">{{ message }}</p>
      }

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

      <section class="lp-section" id="flujo">
        <p class="lp-eyebrow lp-eyebrow--center">Vista dinámica FlowPilot</p>
        <h2 class="lp-section__title">Tu flujo de trabajo, ordenado por diseño</h2>
        <p class="lp-section__lead">
          Pasa de la saturación a la claridad mental con tableros interactivos que responden a tu velocidad.
        </p>

        <div class="lp-board">
          <div class="lp-board__head">
            <span class="lp-board__name">Tablero: Rediseño FlowPilot 2.0</span>
            <span class="lp-chip">Sprint #24</span>
          </div>
          <div class="lp-board__cols">
            @for (col of mockColumns; track col.name) {
              <div class="lp-col">
                <p class="lp-col__head">
                  <span class="lp-dot"></span> {{ col.name }}
                  <span class="lp-col__count">{{ col.cards.length }}</span>
                </p>
                @for (card of col.cards; track card.title) {
                  <article class="lp-mini">
                    <span class="lp-tag">{{ card.tag }}</span>
                    <h3>{{ card.title }}</h3>
                    <p>{{ card.body }}</p>
                  </article>
                }
              </div>
            }
          </div>
        </div>
      </section>

      <section class="lp-section" id="caracteristicas">
        <p class="lp-eyebrow lp-eyebrow--center">¿Por qué elegir FlowPilot?</p>
        <h2 class="lp-section__title">Tres pilares diseñados para el alto rendimiento</h2>
        <p class="lp-section__lead">
          Eliminamos la fricción de los sistemas tradicionales para que tu equipo se concentre en entregar valor.
        </p>

        <div class="lp-pillars">
          @for (pillar of pillars; track pillar.title) {
            <article class="lp-pillar">
              <span class="lp-pillar__icon" aria-hidden="true"><fp-icon [name]="pillar.icon" /></span>
              <h3>{{ pillar.title }}</h3>
              <p>{{ pillar.body }}</p>
              <span class="lp-pillar__link">{{ pillar.link }} <span aria-hidden="true">→</span></span>
            </article>
          }
        </div>
      </section>

      <section class="lp-cta">
        <p class="lp-eyebrow lp-eyebrow--invert">Comienza en segundos</p>
        <h2>¿Listo para retomar el control de tus flujos de trabajo?</h2>
        <p>Únete a los equipos que transformaron el caos de tareas en entregas predecibles con FlowPilot.</p>
        <div class="lp-cta__actions">
          <a routerLink="/projects" class="lp-btn lp-btn--primary"><fp-icon name="folder" /> Ir a Mis proyectos</a>
          <a routerLink="/profile" class="lp-btn lp-btn--dark-ghost">Revisar mi perfil de usuario <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <footer class="lp-footer">
        <span class="lp-footer__brand"><span class="lp-footer__logo" aria-hidden="true">FP</span> FlowPilot</span>
        <span class="lp-footer__note">© 2026 FlowPilot — proyecto de portfolio.</span>
      </footer>
    </div>
  `,
  styles: `
    .lp {
      --lp-bg: #f8fafc;
      --lp-surface: #ffffff;
      --lp-ink: #0f172a;
      --lp-muted: #475569;
      --lp-line: #e2e8f0;
      --lp-brand: #1d4ed8;
      --lp-brand-soft: #eff6ff;
      --lp-focus: #1d4ed8;

      display: flex;
      flex-direction: column;
      gap: clamp(3rem, 8vw, 5.5rem);
      max-width: 1120px;
      margin: 0 auto;
      padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2rem) 0;
      font-family: var(--fp-font-body);
      color: var(--lp-ink);
    }

    .lp h1, .lp h2, .lp h3 { font-family: var(--fp-font-body); line-height: 1.2; }
    .lp p { margin: 0; }
    .lp a { text-decoration: none; }
    .lp a:focus-visible,
    .lp .lp-btn:focus-visible { outline: 2px solid var(--lp-focus); outline-offset: 2px; border-radius: 6px; }

    .lp-notice { margin: 0; font-size: 0.875rem; color: var(--fp-warning); }

    .lp-eyebrow {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 1rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--lp-brand);
    }
    .lp-eyebrow--sm { margin: 0; font-size: 0.66rem; }
    .lp-eyebrow--center { justify-content: center; }
    .lp-eyebrow--invert { color: #93c5fd; justify-content: center; }

    .lp-dot { width: 8px; height: 8px; border-radius: 999px; background: #94a3b8; flex: 0 0 auto; display: inline-block; }
    .lp-dot--brand { background: var(--lp-brand); }
    .lp-dot--green { background: #16a34a; }

    /* Hero */
    .lp-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
      gap: clamp(1.5rem, 4vw, 3rem);
      align-items: start;
      padding: clamp(1.75rem, 4vw, 3rem);
      border: 1px solid var(--lp-line);
      border-radius: 20px;
      background: linear-gradient(135deg, var(--lp-brand-soft), var(--lp-bg) 60%);
    }
    .lp-hero__title { margin: 0; font-size: clamp(2.1rem, 5vw, 3.1rem); font-weight: 800; letter-spacing: -0.02em; }
    .lp-accent { color: var(--lp-brand); }
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

    .lp-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.2rem;
      border-radius: 10px;
      border: 1px solid transparent;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .lp-btn--primary { background: var(--lp-brand); color: #fff; }
    .lp-btn--primary:hover { background: #1e40af; }
    .lp-btn--ghost { background: var(--lp-surface); border-color: var(--lp-line); color: var(--lp-brand); }
    .lp-btn--ghost:hover { border-color: var(--lp-brand); }
    .lp-btn--dark-ghost { background: transparent; border-color: rgba(255, 255, 255, 0.4); color: #fff; }
    .lp-btn--dark-ghost:hover { border-color: #fff; }

    /* Workspace card */
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
    .lp-quick--primary:hover { background: #1e40af; }
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

    /* Generic section */
    .lp-section { text-align: center; scroll-margin-top: 5rem; }
    .lp-section__title { margin: 0 auto; max-width: 24ch; font-size: clamp(1.6rem, 3.5vw, 2.1rem); font-weight: 800; letter-spacing: -0.02em; }
    .lp-section__lead { margin: 0.75rem auto 2rem; max-width: 52ch; color: var(--lp-muted); line-height: 1.6; }

    /* Mock board */
    .lp-board {
      text-align: left;
      padding: 1.25rem;
      border: 1px solid var(--lp-line);
      border-radius: 18px;
      background: var(--lp-surface);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
    }
    .lp-board__head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .lp-board__name { font-weight: 700; font-size: 0.9rem; }
    .lp-chip {
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: var(--lp-brand-soft);
      color: var(--lp-brand);
      font-size: 0.7rem;
      font-weight: 700;
    }
    .lp-board__cols { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .lp-col {
      flex: 1 0 200px;
      min-width: 200px;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.75rem;
      border-radius: 12px;
      background: var(--lp-bg);
    }
    .lp-col__head {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--lp-muted);
    }
    .lp-col__count { margin-left: auto; color: var(--lp-muted); }
    .lp-mini {
      padding: 0.7rem;
      border-radius: 10px;
      border: 1px solid var(--lp-line);
      background: var(--lp-surface);
    }
    .lp-mini h3 { margin: 0.4rem 0 0.25rem; font-size: 0.82rem; font-weight: 700; }
    .lp-mini p { font-size: 0.75rem; color: var(--lp-muted); line-height: 1.45; }
    .lp-tag {
      display: inline-block;
      padding: 0.1rem 0.45rem;
      border-radius: 6px;
      background: var(--lp-brand-soft);
      color: var(--lp-brand);
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* Pillars */
    .lp-pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; text-align: left; }
    .lp-pillar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem;
      border: 1px solid var(--lp-line);
      border-radius: 16px;
      background: var(--lp-surface);
    }
    .lp-pillar__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 10px;
      background: var(--lp-brand-soft);
      color: var(--lp-brand);
    }
    .lp-pillar h3 { margin: 0.5rem 0 0; font-size: 1.05rem; font-weight: 700; }
    .lp-pillar p { color: var(--lp-muted); font-size: 0.86rem; line-height: 1.55; flex: 1; }
    .lp-pillar__link { color: var(--lp-brand); font-weight: 600; font-size: 0.82rem; }

    /* Dark CTA */
    .lp-cta {
      padding: clamp(2rem, 5vw, 3.5rem);
      border-radius: 20px;
      background: linear-gradient(135deg, #0f172a, #1e3a8a);
      color: #fff;
      text-align: center;
    }
    .lp-cta h2 { margin: 0 auto; max-width: 22ch; font-size: clamp(1.5rem, 3.5vw, 2rem); font-weight: 800; }
    .lp-cta p { margin: 0.75rem auto 1.75rem; max-width: 48ch; color: rgba(255, 255, 255, 0.82); line-height: 1.6; }
    .lp-cta__actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
    .lp-cta .lp-btn--primary { background: #fff; color: #1e3a8a; }
    .lp-cta .lp-btn--primary:hover { background: #e2e8f0; }
    .lp-cta a:focus-visible { outline-color: #fff; }

    /* Footer */
    .lp-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1.5rem 0 2.5rem;
      border-top: 1px solid var(--lp-line);
      color: var(--lp-muted);
      font-size: 0.8rem;
    }
    .lp-footer__brand { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700; color: var(--lp-ink); }
    .lp-footer__logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 6px;
      background: var(--lp-brand);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
    }

    @media (max-width: 860px) {
      .lp-hero { grid-template-columns: 1fr; }
      .lp-pillars { grid-template-columns: 1fr; }
    }
  `,
})
export class HomeComponent {
  private readonly accessNotice = inject(AccessNoticeStore);

  readonly notice = signal(this.accessNotice.consume());

  readonly mockColumns: MockColumn[] = [
    {
      name: 'Por hacer',
      cards: [
        {
          tag: 'Investigación',
          title: 'Mapear arquitectura de endpoints',
          body: 'Estandarizar schemas REST y respuestas JSON.',
        },
        {
          tag: 'Diseño',
          title: 'Componentes para modo oscuro',
          body: 'Tokens de diseño y estados de foco.',
        },
      ],
    },
    {
      name: 'En progreso',
      cards: [
        {
          tag: 'Alta prioridad',
          title: 'Integrar panel "Accesos rápidos"',
          body: 'Persistencia de estado con shortcuts configurables.',
        },
      ],
    },
    {
      name: 'En revisión',
      cards: [
        {
          tag: 'QA & code',
          title: 'Auditoría de rendimiento web',
          body: 'Garantizar 95+ en Core Web Vitals móviles.',
        },
      ],
    },
    {
      name: 'Terminado',
      cards: [
        {
          tag: 'Completado',
          title: 'Setup inicial de la organización',
          body: 'Configuración de perfiles y roles de equipo.',
        },
      ],
    },
  ];

  readonly pillars: Pillar[] = [
    {
      icon: 'board',
      title: 'Tableros Kanban visuales',
      body: 'Organiza sprints completos con drag & drop intuitivo, estados adaptables por proyecto y automatizaciones que mueven tarjetas sin esfuerzo manual.',
      link: 'Explorar tableros',
    },
    {
      icon: 'dashboard',
      title: 'Métricas y pulse en vivo',
      body: 'Anticipa cuellos de botella con gráficos de velocidad, métricas de throughput y control en tiempo real de la carga del equipo.',
      link: 'Ver dashboard analítico',
    },
    {
      icon: 'shield',
      title: 'Control de accesos y roles',
      body: 'Gestión de visibilidad de nivel granular: separa tableros de clientes, áreas internas y contratistas con permisos seguros por proyecto.',
      link: 'Seguridad y roles',
    },
  ];
}
