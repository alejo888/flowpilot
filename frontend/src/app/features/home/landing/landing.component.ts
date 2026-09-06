import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpIconComponent } from '../../../shared/ui/icon.component';
import { LandingHeroComponent } from './landing-hero.component';
import { LandingShowcaseComponent } from './landing-showcase.component';

/**
 * Public marketing landing shown at `''` to unauthenticated visitors (see
 * {@link HomeComponent}, which renders a compact welcome instead once the
 * session is authenticated). Frame only — hero and showcase are child
 * components so each stylesheet stays under the `anyComponentStyle` budget;
 * shared `.lp-*` primitives live in `styles.scss` scoped to `.lp`.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, FpIconComponent, LandingHeroComponent, LandingShowcaseComponent],
  template: `
    <div class="lp">
      <app-landing-hero />
      <app-landing-showcase />

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
        <span class="lp-footer__note">© 2026 FlowPilot. Todos los derechos reservados.</span>
      </footer>
    </div>
  `,
  styles: `
    .lp {
      display: flex;
      flex-direction: column;
      gap: clamp(3rem, 8vw, 5.5rem);
      max-width: 1120px;
      margin: 0 auto;
      padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2rem) 0;
      font-family: var(--fp-font-body);
      color: var(--lp-ink);
    }

    .lp-cta {
      padding: clamp(2rem, 5vw, 3.5rem);
      border-radius: 20px;
      background: linear-gradient(135deg, #0f172a, #1e3a8a);
      color: #fff;
      text-align: center;
    }
    .lp-cta h2 { margin: 0 auto; max-width: 22ch; font-size: clamp(1.5rem, 3.5vw, 2rem); font-weight: 800; line-height: 1.2; }
    .lp-cta p { margin: 0.75rem auto 1.75rem; max-width: 48ch; color: rgba(255, 255, 255, 0.82); line-height: 1.6; }
    .lp-cta__actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
    .lp-cta .lp-btn--primary { background: #fff; color: #1e3a8a; }
    .lp-cta .lp-btn--primary:hover { background: #e2e8f0; }
    .lp-cta a:focus-visible { outline-color: #fff; }

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
  `,
})
export class LandingComponent {}
