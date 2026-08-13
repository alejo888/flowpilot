import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { ProjectsStore } from './projects.store';

/**
 * Projects list + create form (spec: projects-ui; design D4). ONE component
 * with an inline create form — no presentational-child split, matching
 * `AdminUsersComponent`/`BoardComponent` precedent. Loading/empty/error
 * states, a row-level link into each project's board, and a create form
 * with client-side required-name validation (design D6) that still surfaces
 * server errors, plus a reset-on-success effect (design D7). Visual layer
 * uses the FlowPilot shared/ui kit (fp-card/fp-input/fp-button/fp-badge) —
 * behavior is unchanged from the raw-HTML version this replaces.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, FpBadgeComponent, FpButtonComponent, FpCardComponent, FpInputComponent],
  template: `
    <div class="projects">
      <h1 class="projects-title">Proyectos</h1>

      @if (error(); as message) {
        <p data-testid="projects-error" class="projects-error">{{ message }}</p>
      }

      <fp-card class="project-create-card">
        <form class="project-create" (submit)="onSubmit($event)">
          @if (formError(); as message) {
            <p data-testid="project-create-error" class="project-create-error">{{ message }}</p>
          }
          <fp-input
            label="Nombre"
            testId="project-create-name"
            [value]="name()"
            [required]="true"
            (valueChange)="name.set($event)"
          />
          <fp-input
            label="Descripción"
            testId="project-create-description"
            [value]="description()"
            (valueChange)="description.set($event)"
          />
          <fp-button type="submit" testId="project-create-submit" [disabled]="creating()">
            Crear proyecto
          </fp-button>
        </form>
      </fp-card>

      @if (loading()) {
        <p data-testid="projects-loading">Cargando proyectos…</p>
      } @else if (projects().length === 0) {
        <p data-testid="projects-empty">Todavía no tienes proyectos.</p>
      } @else {
        <ul class="projects-list">
          @for (project of projects(); track project.id) {
            <li [attr.data-testid]="'project-row-' + project.id">
              <fp-card class="project-row-card">
                <div class="project-row">
                  <div class="project-row-main">
                    <a
                      [routerLink]="['/projects', project.id, 'board']"
                      data-testid="project-board-link"
                      class="project-row-name"
                      >{{ project.name }}</a
                    >
                    <span data-testid="project-description" class="project-row-description">{{
                      project.description
                    }}</span>
                  </div>
                  <div class="project-row-meta">
                    <fp-badge variant="neutral" data-testid="project-status">{{ project.status }}</fp-badge>
                    <a
                      [routerLink]="['/projects', project.id, 'members']"
                      data-testid="project-members-link"
                      class="project-row-link"
                      >Miembros</a
                    >
                  </div>
                </div>
              </fp-card>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .projects {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-6);
      padding: var(--fp-space-8);
    }

    .projects-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .projects-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .project-create-card {
      max-width: 480px;
    }

    .project-create {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .project-create-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .projects-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
    }

    .project-row-card {
      padding: var(--fp-space-4);
    }

    .project-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--fp-space-4);
    }

    .project-row-main {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-1);
    }

    .project-row-name {
      font-family: var(--fp-font-display);
      font-weight: 600;
      font-size: 1.125rem;
      color: var(--fp-text);
      text-decoration: none;
    }

    .project-row-name:hover {
      color: var(--fp-accent);
    }

    .project-row-description {
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-text-muted);
    }

    .project-row-meta {
      display: flex;
      align-items: center;
      gap: var(--fp-space-4);
    }

    .project-row-link {
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--fp-accent);
      text-decoration: none;
    }

    .project-row-link:hover {
      color: var(--fp-accent-hover);
    }
  `,
})
export class ProjectsComponent implements OnInit {
  private readonly store = inject(ProjectsStore);

  readonly projects = this.store.projects;
  readonly loading = this.store.loading;
  readonly creating = this.store.creating;
  readonly error = this.store.error;

  readonly name = signal('');
  readonly description = signal('');
  readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.store.lastCreated() !== null) {
        this.name.set('');
        this.description.set('');
        this.formError.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.store.loadProjects();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    const trimmedName = this.name().trim();
    if (trimmedName === '') {
      this.formError.set('El nombre es obligatorio');
      return;
    }
    this.formError.set(null);
    const trimmedDescription = this.description().trim();
    this.store.createProject(trimmedName, trimmedDescription === '' ? null : trimmedDescription);
  }
}
