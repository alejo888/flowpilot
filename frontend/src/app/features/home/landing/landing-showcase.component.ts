import { Component } from '@angular/core';

import { FpIconComponent, FpIconName } from '../../../shared/ui/icon.component';

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

/**
 * Public landing showcase: a static mock Kanban ("Tablero Kanban" anchor) and
 * the three feature pillars ("Características" anchor). Neither is wired to
 * data — they exist to demonstrate the product shape on the marketing page.
 * The section ids back the shell's in-page nav.
 */
@Component({
  selector: 'app-landing-showcase',
  standalone: true,
  imports: [FpIconComponent],
  template: `
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
  `,
  styles: `
    /* the two sections share this component; restore the inter-section rhythm
       that .lp's flex gap gives the hero / showcase / cta siblings */
    #caracteristicas { margin-top: clamp(3rem, 8vw, 5.5rem); }

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
      background: var(--lp-ground);
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
    .lp-mini h3 { margin: 0.4rem 0 0.25rem; font-size: 0.82rem; font-weight: 700; line-height: 1.3; }
    .lp-mini p { margin: 0; font-size: 0.75rem; color: var(--lp-muted); line-height: 1.45; }
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
    .lp-pillar p { margin: 0; color: var(--lp-muted); font-size: 0.86rem; line-height: 1.55; flex: 1; }
    .lp-pillar__link { color: var(--lp-brand); font-weight: 600; font-size: 0.82rem; }

    @media (max-width: 860px) {
      .lp-pillars { grid-template-columns: 1fr; }
    }
  `,
})
export class LandingShowcaseComponent {
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
