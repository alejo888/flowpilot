import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { PROJECT_ROLE_OPTIONS, ProjectMember, ProjectRole } from './project-member.model';
import { ProjectMembersStore } from './project-members.store';

/**
 * Project member roster view (spec: project-members-ui; design D7, §4).
 * PR1 was read-only. PR2 added name/email resolution and the add-member
 * form. PR3 adds: a per-row role select (`store.changeRole`, only fired
 * when the value actually differs), a one-click remove for other members'
 * rows, and a two-step self-removal confirmation (design D6, mirroring
 * `AdminPermissionsComponent`'s inline `conflict-dialog` pattern — no
 * modal/dialog component exists in this codebase). `isSelf` compares
 * `member.userId` against `AuthStore.currentUserId` (design D5).
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
              <select
                data-testid="member-role-select"
                [disabled]="mutatingUserId() === member.userId"
                (change)="onRoleChangeForMember(member, $event)"
              >
                @for (option of roleOptions; track option.value) {
                  <option [value]="option.value" [selected]="option.value === member.role">
                    {{ option.label }}
                  </option>
                }
              </select>
              <span data-testid="member-joined-at">{{ member.joinedAt }}</span>
              @if (isSelf(member)) {
                <button
                  type="button"
                  data-testid="member-remove-self"
                  [disabled]="mutatingUserId() === member.userId"
                  (click)="onRemove(member)"
                >
                  Quitarme del proyecto
                </button>
              } @else {
                <button
                  type="button"
                  data-testid="member-remove"
                  [disabled]="mutatingUserId() === member.userId"
                  (click)="onRemove(member)"
                >
                  Quitar
                </button>
              }
            </li>
          }
        </ul>
      }

      @if (confirmingSelfRemoval()) {
        <div data-testid="self-remove-dialog" class="self-remove-dialog">
          <p>
            Vas a quitarte a vos mismo de este proyecto. Perderás el acceso salvo que seas el dueño
            o un administrador.
          </p>
          <button type="button" data-testid="self-remove-confirm" (click)="onConfirmSelfRemoval()">
            Sí, salir del proyecto
          </button>
          <button type="button" data-testid="self-remove-cancel" (click)="onCancelSelfRemoval()">
            Cancelar
          </button>
        </div>
      }
    </div>
  `,
})
export class ProjectMembersComponent implements OnInit {
  private readonly store = inject(ProjectMembersStore);
  private readonly auth = inject(AuthStore);

  readonly projectId = input.required<number>();

  readonly members = this.store.members;
  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly adding = this.store.adding;
  readonly mutatingUserId = this.store.mutatingUserId;
  readonly error = this.store.error;

  readonly roleOptions = PROJECT_ROLE_OPTIONS;

  readonly userFilter = signal('');
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedRole = signal<ProjectRole | null>(null);
  readonly addFormError = signal<string | null>(null);
  readonly confirmingSelfRemoval = signal(false);

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

  isSelf(member: ProjectMember): boolean {
    return member.userId === this.auth.currentUserId();
  }

  onRoleChangeForMember(member: ProjectMember, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ProjectRole;
    if (value === member.role) {
      return;
    }
    this.store.changeRole(this.projectId(), member.userId, value);
  }

  onRemove(member: ProjectMember): void {
    if (this.isSelf(member)) {
      this.confirmingSelfRemoval.set(true);
      return;
    }
    this.store.removeMember(this.projectId(), member.userId);
  }

  onConfirmSelfRemoval(): void {
    this.confirmingSelfRemoval.set(false);
    const currentUserId = this.auth.currentUserId();
    if (currentUserId !== null) {
      this.store.removeMember(this.projectId(), currentUserId);
    }
  }

  onCancelSelfRemoval(): void {
    this.confirmingSelfRemoval.set(false);
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
