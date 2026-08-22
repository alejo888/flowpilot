import { DatePipe } from '@angular/common';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { FpIconComponent } from '../../shared/ui/icon.component';
import { projectStatusBadgeVariant } from './project-status';
import { ProjectsStore } from './projects.store';

/**
 * Projects list + create form (spec: projects-ui; design D4). ONE component
 * with the create form behind a trigger button + `fp-dialog` — no
 * presentational-child split, matching `AdminUsersComponent`/`BoardComponent`
 * precedent. Loading/empty/error states, a row-level link into each
 * project's board, and a create form with client-side required-name
 * validation (design D6) that still surfaces server errors, plus a
 * reset-and-close-on-success effect (design D7). Visual layer uses the
 * FlowPilot shared/ui kit (fp-card/fp-dialog/fp-input/fp-button/fp-badge).
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FpBadgeComponent,
    FpButtonComponent,
    FpCardComponent,
    FpDialogComponent,
    FpInputComponent,
    FpIconComponent,
  ],
  template: `
    <div class="projects">
      <div class="projects-header">
        <h1 class="projects-title">Proyectos</h1>
        <fp-button icon="add" testId="project-create-trigger" (click)="showCreateDialog.set(true)">
          Crear proyecto
        </fp-button>
      </div>

      @if (error(); as message) {
        <p data-testid="projects-error" class="projects-error">{{ message }}</p>
      }

      @if (showCreateDialog()) {
        <fp-dialog
          data-testid="project-create-dialog"
          label="project-create-dialog-title"
          describedById="project-create-dialog-description"
          (closed)="closeCreateDialog()"
        >
          <h2 id="project-create-dialog-title">Crear proyecto</h2>
          <p id="project-create-dialog-description">Completá los datos del nuevo proyecto.</p>
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
            <fp-input
              label="Código"
              testId="project-create-code"
              [value]="code()"
              (valueChange)="code.set($event)"
            />
            <fp-input
              label="Fecha de inicio"
              type="date"
              testId="project-create-start-date"
              [value]="startDate()"
              (valueChange)="startDate.set($event)"
            />
            <fp-input
              label="Fecha estimada de fin"
              type="date"
              testId="project-create-estimated-end-date"
              [value]="estimatedEndDate()"
              (valueChange)="estimatedEndDate.set($event)"
            />
            <fp-input
              label="Tecnologías"
              testId="project-create-technologies"
              [value]="technologies()"
              (valueChange)="technologies.set($event)"
            />
            <fp-input
              label="URL del repositorio"
              type="url"
              testId="project-create-repository-url"
              [value]="repositoryUrl()"
              (valueChange)="repositoryUrl.set($event)"
            />
            <div class="project-create-actions">
              <fp-button type="submit" icon="save" testId="project-create-submit" [disabled]="creating()">
                Crear proyecto
              </fp-button>
              <fp-button
                type="button"
                variant="secondary"
                testId="project-create-cancel"
                (click)="closeCreateDialog()"
              >
                Cancelar
              </fp-button>
            </div>
          </form>
        </fp-dialog>
      }

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
                      [routerLink]="['/projects', project.id]"
                      data-testid="project-detail-link"
                      class="project-row-name"
                      >{{ project.name }}</a
                    >
                    <span data-testid="project-description" class="project-row-description">{{
                      project.description
                    }}</span>
                    @if (project.code) {
                      <span data-testid="project-code" class="project-row-code">{{ project.code }}</span>
                    }
                    @if (project.startDate || project.estimatedEndDate) {
                      <span data-testid="project-dates" class="project-row-dates">
                        @if (project.startDate) {
                          {{ project.startDate | date: 'd MMM y' }}
                        }
                        &ndash;
                        @if (project.estimatedEndDate) {
                          {{ project.estimatedEndDate | date: 'd MMM y' }}
                        }
                      </span>
                    }
                    @if (project.technologies) {
                      <span data-testid="project-technologies" class="project-row-technologies">{{
                        project.technologies
                      }}</span>
                    }
                    @if (project.repositoryUrl) {
                      <a
                        [href]="project.repositoryUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="project-repository-link"
                        class="project-row-link"
                        ><fp-icon name="external-link" /> Repositorio</a
                      >
                    }
                  </div>
                  <div class="project-row-meta">
                    <fp-badge [variant]="statusBadgeVariant(project.status)" data-testid="project-status">{{
                      project.status
                    }}</fp-badge>
                    <a
                      [routerLink]="['/projects', project.id, 'board']"
                      data-testid="project-board-link"
                      class="project-row-link"
                      ><fp-icon name="board" /> Tablero</a
                    >
                    <a [routerLink]="['/projects', project.id, 'backlog']" data-testid="project-backlog-link" class="project-row-link"><fp-icon name="list" /> Backlog</a>
                    <a
                      [routerLink]="['/projects', project.id, 'members']"
                      data-testid="project-members-link"
                      class="project-row-link"
                      ><fp-icon name="users" /> Miembros</a
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

    .projects-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--fp-space-4);
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

    .project-create {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      width: min(90vw, 420px);
    }

    .project-create-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .project-create-actions {
      display: flex;
      gap: var(--fp-space-3);
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
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--fp-space-4);
    }

    .project-row-main {
      display: flex;
      flex-direction: column;
      // Flex items default to min-width: auto (their content's intrinsic
      // width), so an unbroken long word (project name/technologies with no
      // spaces) forced this wider than the row instead of shrinking to fit.
      min-width: 0;
      gap: var(--fp-space-1);
    }

    .project-row-name {
      font-family: var(--fp-font-display);
      font-weight: 600;
      font-size: 1.125rem;
      color: var(--fp-text);
      text-decoration: none;
      overflow-wrap: break-word;
    }

    .project-row-name:hover {
      color: var(--fp-accent);
    }

    .project-row-description {
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-text-muted);
      overflow-wrap: break-word;
    }

    .project-row-meta {
      display: flex;
      flex-wrap: wrap;
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

    .project-row-code {
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--fp-text-muted);
      overflow-wrap: break-word;
    }

    .project-row-dates,
    .project-row-technologies {
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
      color: var(--fp-text-muted);
      overflow-wrap: break-word;
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
  readonly code = signal('');
  readonly startDate = signal('');
  readonly estimatedEndDate = signal('');
  readonly technologies = signal('');
  readonly repositoryUrl = signal('');
  readonly formError = signal<string | null>(null);
  readonly showCreateDialog = signal(false);

  protected readonly statusBadgeVariant = projectStatusBadgeVariant;

  constructor() {
    effect(() => {
      if (this.store.lastCreated() !== null) {
        this.name.set('');
        this.description.set('');
        this.code.set('');
        this.startDate.set('');
        this.estimatedEndDate.set('');
        this.technologies.set('');
        this.repositoryUrl.set('');
        this.formError.set(null);
        this.showCreateDialog.set(false);
      }
    });
  }

  closeCreateDialog(): void {
    this.showCreateDialog.set(false);
    this.formError.set(null);
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
    this.store.createProject({
      name: trimmedName,
      description: blankToNull(this.description()),
      code: blankToNull(this.code()),
      startDate: blankToNull(this.startDate()),
      estimatedEndDate: blankToNull(this.estimatedEndDate()),
      technologies: blankToNull(this.technologies()),
      repositoryUrl: blankToNull(this.repositoryUrl()),
    });
  }
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
