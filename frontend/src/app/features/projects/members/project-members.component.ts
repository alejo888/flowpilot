import { Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PROJECT_ROLE_OPTIONS, ProjectRole } from './project-member.model';
import { ProjectMembersStore } from './project-members.store';

/**
 * Project member roster view (spec: project-members-ui; design D7, §4).
 * PR1 is read-only: loads and displays the roster with mutually-exclusive
 * loading/empty/populated states plus a back-link to the projects list.
 * Members are shown as `Usuario #{userId}` placeholders — the user
 * directory (`UsersApiService`) and name/email resolution land in PR2, per
 * design's disclosed interim state.
 */
@Component({
  selector: 'app-project-members',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="project-members">
      <a routerLink="/projects" data-testid="members-projects-link">Volver a proyectos</a>

      <h1>Miembros del proyecto</h1>

      @if (error(); as message) {
        <p data-testid="project-members-error" class="project-members-error">{{ message }}</p>
      }

      @if (loading()) {
        <p data-testid="members-loading">Cargando miembros…</p>
      } @else if (members().length === 0) {
        <p data-testid="members-empty">
          Este proyecto todavía no tiene miembros. El dueño del proyecto no aparece
          automáticamente en la lista.
        </p>
      } @else {
        <ul>
          @for (member of members(); track member.id) {
            <li [attr.data-testid]="'member-row-' + member.id">
              <span data-testid="member-user">Usuario #{{ member.userId }}</span>
              <span data-testid="member-role">{{ roleLabel(member.role) }}</span>
              <span data-testid="member-joined-at">{{ member.joinedAt }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class ProjectMembersComponent implements OnInit {
  private readonly store = inject(ProjectMembersStore);

  readonly projectId = input.required<number>();

  readonly members = this.store.members;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  ngOnInit(): void {
    this.store.loadMembers(this.projectId());
  }

  roleLabel(role: ProjectRole): string {
    return PROJECT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
  }
}
