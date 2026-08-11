import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProjectsStore } from './projects.store';

/**
 * Projects list + create form (spec: projects-ui; design D4). ONE component
 * with an inline create form — no presentational-child split, matching
 * `AdminUsersComponent`/`BoardComponent` precedent. Loading/empty/error
 * states, a row-level link into each project's board, and a create form
 * with client-side required-name validation (design D6) that still surfaces
 * server errors, plus a reset-on-success effect (design D7).
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="projects">
      <h1>Proyectos</h1>

      @if (error(); as message) {
        <p data-testid="projects-error" class="projects-error">{{ message }}</p>
      }

      <form class="project-create" (submit)="onSubmit($event)">
        @if (formError(); as message) {
          <p data-testid="project-create-error">{{ message }}</p>
        }
        <label>
          Nombre
          <input
            data-testid="project-create-name"
            [value]="name()"
            (input)="name.set(inputValue($event))"
            required
          />
        </label>
        <label>
          Descripción
          <input
            data-testid="project-create-description"
            [value]="description()"
            (input)="description.set(inputValue($event))"
          />
        </label>
        <button type="submit" data-testid="project-create-submit" [disabled]="creating()">
          Crear proyecto
        </button>
      </form>

      @if (loading()) {
        <p data-testid="projects-loading">Cargando proyectos…</p>
      } @else if (projects().length === 0) {
        <p data-testid="projects-empty">Todavía no tienes proyectos.</p>
      } @else {
        <ul>
          @for (project of projects(); track project.id) {
            <li [attr.data-testid]="'project-row-' + project.id">
              <a [routerLink]="['/projects', project.id, 'board']" data-testid="project-board-link">{{
                project.name
              }}</a>
              <span data-testid="project-description">{{ project.description }}</span>
              <span data-testid="project-status">{{ project.status }}</span>
            </li>
          }
        </ul>
      }
    </div>
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

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
