import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PROJECT_ROLE_OPTIONS, ProjectMember, ProjectRole } from './project-member.model';
import { ProjectMembersStore } from './project-members.store';
import { UserSummary } from './user-summary.model';

/**
 * Project member roster view (spec: project-members-ui; design D7, §4).
 * PR1 was read-only. PR2 adds: name/email resolution for existing roster
 * rows (falling back to the `Usuario #{userId}` placeholder while the
 * directory has not resolved yet) and an add-member form with a
 * client-side text filter over the fetched user directory (design D3),
 * excluding users already on the roster, plus client-side required-field
 * validation (design D4) and a reset-on-success effect keyed on
 * `store.lastAdded()` (mirroring `ProjectsComponent`'s reset effect).
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

      <form class="member-add" data-testid="member-add-form" (submit)="onSubmit($event)">
        @if (addFormError(); as message) {
          <p data-testid="member-add-error">{{ message }}</p>
        }
        <label>
          Filtrar usuarios
          <input
            data-testid="member-add-filter"
            [value]="userFilter()"
            (input)="userFilter.set(inputValue($event))"
          />
        </label>
        <label>
          Usuario
          <select data-testid="member-add-user-select" (change)="onUserChange($event)">
            <option value="">Elegí un usuario</option>
            @for (user of selectableUsers(); track user.id) {
              <option [value]="user.id">{{ user.name }} ({{ user.email }})</option>
            }
          </select>
        </label>
        <label>
          Rol
          <select data-testid="member-add-role-select" (change)="onRoleChange($event)">
            <option value="">Elegí un rol</option>
            @for (option of roleOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        <button type="submit" data-testid="member-add-submit" [disabled]="adding()">Agregar miembro</button>
      </form>

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
              <span data-testid="member-user">{{ memberLabel(member) }}</span>
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
  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly adding = this.store.adding;
  readonly error = this.store.error;

  readonly roleOptions = PROJECT_ROLE_OPTIONS;

  readonly userFilter = signal('');
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedRole = signal<ProjectRole | null>(null);
  readonly addFormError = signal<string | null>(null);

  readonly selectableUsers = computed(() => {
    const taken = this.store.memberUserIds();
    const needle = this.userFilter().trim().toLowerCase();
    return this.users()
      .filter((user) => !taken.has(user.id))
      .filter(
        (user) =>
          needle === '' || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
      );
  });

  constructor() {
    effect(() => {
      if (this.store.lastAdded() !== null) {
        this.userFilter.set('');
        this.selectedUserId.set(null);
        this.selectedRole.set(null);
        this.addFormError.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.store.loadMembers(this.projectId());
    this.store.loadUsers();
  }

  memberLabel(member: ProjectMember): string {
    const user = this.users().find((u) => u.id === member.userId);
    return user ? `${user.name} (${user.email})` : `Usuario #${member.userId}`;
  }

  roleLabel(role: ProjectRole): string {
    return PROJECT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
  }

  onUserChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedUserId.set(value === '' ? null : Number(value));
  }

  onRoleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ProjectRole | '';
    this.selectedRole.set(value === '' ? null : value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    const userId = this.selectedUserId();
    const role = this.selectedRole();
    if (userId === null || role === null) {
      this.addFormError.set('Elegí un usuario y un rol');
      return;
    }
    this.addFormError.set(null);
    this.store.addMember(this.projectId(), userId, role);
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
