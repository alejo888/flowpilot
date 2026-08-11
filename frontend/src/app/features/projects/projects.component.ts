import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProjectsStore } from './projects.store';

/**
 * Projects list (spec: projects-ui; design D4). List-only for this slice —
 * loading/empty/error states plus a row-level link into each project's
 * board. Create form + Home/Board nav links land in PR 2 (design section 8).
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
  readonly error = this.store.error;

  ngOnInit(): void {
    this.store.loadProjects();
  }
}
