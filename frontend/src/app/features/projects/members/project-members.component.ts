import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { FpBadgeComponent } from '../../../shared/ui/badge.component';
import { FpButtonComponent } from '../../../shared/ui/button.component';
import { FpCardComponent } from '../../../shared/ui/card.component';
import { FpIconComponent } from '../../../shared/ui/icon.component';
import { FpDialogComponent } from '../../../shared/ui/dialog.component';
import { FpInputComponent } from '../../../shared/ui/input.component';
import { FpSelectComponent } from '../../../shared/ui/select.component';
import { PROJECT_ROLE_OPTIONS, ProjectMember, ProjectRole } from './project-member.model';
import { ProjectMembersStore } from './project-members.store';

/**
 * Project member roster view (spec: project-members-ui; design D7, §4).
 * PR1 was read-only. PR2 added name/email resolution and the add-member
 * form. PR3 adds: a per-row role select (`store.changeRole`, only fired
 * when the value actually differs), a one-click remove for other members'
 * rows, and a two-step self-removal confirmation (design D6, mirroring
 * `AdminPermissionsComponent`'s inline `conflict-dialog` pattern — no
 * modal/dialog component existed in this codebase, so this restyle adds
 * one minimal `fp-dialog` inline-confirmation shell under `shared/ui`).
 * `isSelf` compares `member.userId` against `AuthStore.currentUserId`
 * (design D5). Visual layer uses the full FlowPilot shared/ui kit
 * (fp-card/fp-input/fp-select/fp-button/fp-badge/fp-dialog) — behavior is
 * unchanged from the raw-HTML version this replaces.
 */
@Component({
  selector: 'app-project-members',
  standalone: true,
  imports: [
    DatePipe,
        RouterLink,
    FpBadgeComponent,
    FpButtonComponent,
        FpIconComponent,
    FpCardComponent,
    FpDialogComponent,
    FpInputComponent,
    FpSelectComponent,
  ],
  template: `
    <div class="project-members"><a class="project-back-link" routerLink="/projects"><fp-icon name="arrow-left" /> Volver a proyectos</a>
      <h1 class="project-members-title">Miembros del proyecto</h1>

      @if (error(); as message) {
        <p data-testid="project-members-error" class="project-members-error">{{ message }}</p>
      }

      <fp-card class="member-add-card">
        <form class="member-add" data-testid="member-add-form" (submit)="onSubmit($event)">
          @if (addFormError(); as message) {
            <p data-testid="member-add-error" class="member-add-error">{{ message }}</p>
          }
          <fp-input
            label="Filtrar usuarios"
            testId="member-add-filter"
            [value]="userFilter()"
            (valueChange)="userFilter.set($event)"
          />
          <fp-select
            label="Usuario"
            testId="member-add-user-select"
            placeholder="Elegí un usuario"
            [value]="selectedUserId() === null ? '' : String(selectedUserId())"
            [options]="selectableUserOptions()"
            (valueChange)="onUserChange($event)"
          />
          <fp-select
            label="Rol"
            testId="member-add-role-select"
            placeholder="Elegí un rol"
            [value]="selectedRole() ?? ''"
            [options]="roleSelectOptions"
            (valueChange)="onRoleChange($event)"
          />
          <fp-button type="submit" testId="member-add-submit" [disabled]="adding()">
            Agregar miembro
          </fp-button>
        </form>
      </fp-card>

      @if (loading()) {
        <p data-testid="members-loading">Cargando miembros…</p>
      } @else if (members().length === 0) {
        <p data-testid="members-empty" class="members-empty">
          Este proyecto todavía no tiene miembros. El dueño del proyecto no aparece
          automáticamente en la lista.
        </p>
      } @else {
        <ul class="members-list">
          @for (member of members(); track member.id) {
            <li [attr.data-testid]="'member-row-' + member.id">
              <fp-card class="member-row-card">
                <div class="member-row">
                  <div class="member-row-main">
                    <span data-testid="member-user" class="member-row-user">{{ memberLabel(member) }}</span>
                    <fp-badge variant="neutral" data-testid="member-role">{{ roleLabel(member.role) }}</fp-badge>
                    <span data-testid="member-joined-at" class="member-row-joined">{{
                      member.joinedAt | date: "d 'de' MMMM y, HH:mm"
                    }}</span>
                  </div>
                  <div class="member-row-actions">
                    @for (resetToken of [roleResetToken(member.userId)]; track resetToken) {
                      <fp-select
                        testId="member-role-select"
                        [value]="member.role"
                        [options]="roleSelectOptions"
                        [disabled]="isMutating(member.userId)"
                        (valueChange)="onRoleChangeForMember(member, $event)"
                      />
                    }
                    @if (isSelf(member)) {
                      <fp-button
                        variant="danger"
                        testId="member-remove-self"
                        [disabled]="isMutating(member.userId)"
                        (click)="onRemove(member)"
                      >
                        Quitarme del proyecto
                      </fp-button>
                    } @else {
                      <fp-button
                        variant="danger"
                        testId="member-remove"
                        [disabled]="isMutating(member.userId)"
                        (click)="onRemove(member)"
                      >
                        Quitar
                      </fp-button>
                    }
                  </div>
                </div>
              </fp-card>
            </li>
          }
        </ul>
      }

      @if (confirmingSelfRemoval()) {
        <fp-dialog
          data-testid="self-remove-dialog"
          describedById="self-remove-dialog-description"
          (closed)="onCancelSelfRemoval()"
        >
          <p id="self-remove-dialog-description" class="self-remove-dialog-text">
            Vas a quitarte a vos mismo de este proyecto. Perderás el acceso salvo que seas el dueño
            o un administrador.
          </p>
          <div class="self-remove-dialog-actions">
            <fp-button variant="danger" testId="self-remove-confirm" (click)="onConfirmSelfRemoval()">
              Sí, salir del proyecto
            </fp-button>
            <fp-button variant="secondary" testId="self-remove-cancel" (click)="onCancelSelfRemoval()">
              Cancelar
            </fp-button>
          </div>
        </fp-dialog>
      }
    </div>
  `,
  styles: `
    .project-members {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
      padding: var(--fp-space-8);
    }

    .project-members-title {
      margin: 0;
      font-family: var(--fp-font-display);
      font-optical-sizing: auto;
      font-weight: 600;
      font-size: 1.75rem;
      color: var(--fp-text);
    }

    .project-members-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .member-add-card {
      max-width: 520px;
    }

    .member-add {
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-4);
    }

    .member-add-error {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.875rem;
      color: var(--fp-danger);
    }

    .members-empty {
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text-muted);
    }

    .members-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--fp-space-3);
    }

    .member-row-card {
      padding: var(--fp-space-4);
    }

    .member-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--fp-space-4);
      flex-wrap: wrap;
    }

    .member-row-main {
      display: flex;
      align-items: center;
      gap: var(--fp-space-3);
      flex-wrap: wrap;
    }

    .member-row-user {
      font-family: var(--fp-font-body);
      font-weight: 600;
      color: var(--fp-text);
      overflow-wrap: break-word;
    }

    .member-row-joined {
      font-family: var(--fp-font-body);
      font-size: 0.8125rem;
      color: var(--fp-text-muted);
    }

    .member-row-actions {
      display: flex;
      align-items: center;
      gap: var(--fp-space-3);
    }

    .self-remove-dialog-text {
      margin: 0;
      font-family: var(--fp-font-body);
      font-size: 0.9375rem;
      color: var(--fp-text);
    }

    .self-remove-dialog-actions {
      display: flex;
      gap: var(--fp-space-3);
    }
  `,
})
export class ProjectMembersComponent implements OnInit {
  private readonly store = inject(ProjectMembersStore);
  private readonly auth = inject(AuthStore);

  readonly projectId = input.required<number, string>({ transform: numberAttribute });

  readonly members = this.store.members;
  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly adding = this.store.adding;
  readonly error = this.store.error;
  readonly isMutating = (userId: number) => this.store.isMutating(userId);

  readonly roleSelectOptions: ReadonlyArray<{ value: string; label: string }> = PROJECT_ROLE_OPTIONS;

  readonly userFilter = signal('');
  readonly selectedUserId = signal<number | null>(null);
  readonly selectedRole = signal<ProjectRole | null>(null);
  readonly addFormError = signal<string | null>(null);
  readonly confirmingSelfRemoval = signal(false);
  protected readonly String = String;

  /**
   * Bumped per-row on a failed role change to force `@for`'s `track` to
   * recreate that row's `<fp-select>`. Same rationale as
   * `ProjectDetailComponent.statusResetToken`: Angular's property-binding
   * diffing skips the DOM write when `member.role` itself hasn't changed
   * (the update failed), but the browser already moved its own live
   * selection to whatever the user just clicked.
   */
  private readonly roleResetTokens = signal<ReadonlyMap<number, number>>(new Map());

  roleResetToken(userId: number): number {
    return this.roleResetTokens().get(userId) ?? 0;
  }

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

  readonly selectableUserOptions = computed<ReadonlyArray<{ value: string; label: string }>>(() =>
    this.selectableUsers().map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` })),
  );

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

  async onRoleChangeForMember(member: ProjectMember, role: string): Promise<void> {
    const value = role as ProjectRole;
    if (value === member.role) {
      return;
    }
    const succeeded = await this.store.changeRole(this.projectId(), member.userId, value);
    if (!succeeded) {
      const next = new Map(this.roleResetTokens());
      next.set(member.userId, (next.get(member.userId) ?? 0) + 1);
      this.roleResetTokens.set(next);
    }
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

  onUserChange(value: string): void {
    this.selectedUserId.set(value === '' ? null : Number(value));
  }

  onRoleChange(value: string): void {
    this.selectedRole.set(value === '' ? null : (value as ProjectRole));
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
}
