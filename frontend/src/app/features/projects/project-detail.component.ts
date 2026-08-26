import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, numberAttribute, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { FpBadgeComponent } from '../../shared/ui/badge.component';
import { FpButtonComponent } from '../../shared/ui/button.component';
    import { FpIconComponent } from '../../shared/ui/icon.component';
import { FpCardComponent } from '../../shared/ui/card.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { FpInputComponent } from '../../shared/ui/input.component';
import { FpSelectComponent } from '../../shared/ui/select.component';
import { hasPermission, ProjectStatus } from './project.model';
import { projectStatusBadgeVariant } from './project-status';
import { ProjectsStore } from './projects.store';
import { CommentsStore } from '../comments/comments.store';
import { Comment } from '../comments/comments.model';

const STATUS_OPTIONS = [
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
] as const;

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, FpBadgeComponent, FpButtonComponent, FpIconComponent, FpCardComponent, FpDialogComponent, FpInputComponent, FpSelectComponent],
  template: `
    <main class="project-detail">
      @if (loading()) { <p data-testid="project-detail-loading">Cargando proyecto…</p> }
      @if (error(); as message) { <p data-testid="project-detail-error" class="error">{{ message }}</p> }
      @if (project(); as current) {
        <header class="detail-header">
          <div class="project-context-links"><a routerLink="/projects" class="project-back-link"><fp-icon name="arrow-left" /> Volver a proyectos</a><a [routerLink]="['/projects', projectId(), 'backlog']" class="project-link"><fp-icon name="list" /> Backlog y sprints</a><a [routerLink]="['/projects', projectId(), 'dashboard']" class="project-link"><fp-icon name="dashboard" /> Dashboard</a><h1 data-testid="project-detail-name">{{ current.name }}</h1></div>
          <fp-badge [variant]="statusBadgeVariant(current.status)" data-testid="project-detail-status">{{ current.status }}</fp-badge>
        </header>
        <fp-card><div class="summary">
          <p data-testid="project-detail-description">{{ current.description || 'Sin descripción' }}</p>
          @if (current.code) { <span data-testid="project-detail-code">{{ current.code }}</span> }
          @if (current.technologies) { <span data-testid="project-detail-technologies">{{ current.technologies }}</span> }
          <span>Actualizado {{ current.updatedAt | date: 'd MMM y' }}</span>
        </div></fp-card>
        <fp-card><form data-testid="project-edit-form" (submit)="onSubmit($event)">
          <h2>Editar proyecto</h2>
          <fp-input label="Nombre" testId="project-edit-name" [value]="name()" [required]="true" (valueChange)="name.set($event)" />
          <fp-input label="Descripción" testId="project-edit-description" [value]="description()" (valueChange)="description.set($event)" />
          <fp-input label="Código" testId="project-edit-code" [value]="code()" (valueChange)="code.set($event)" />
          <fp-input label="Fecha de inicio" type="date" testId="project-edit-start-date" [value]="startDate()" (valueChange)="startDate.set($event)" />
          <fp-input label="Fecha estimada de fin" type="date" testId="project-edit-estimated-end-date" [value]="estimatedEndDate()" (valueChange)="estimatedEndDate.set($event)" />
          <fp-input label="Tecnologías" testId="project-edit-technologies" [value]="technologies()" (valueChange)="technologies.set($event)" />
          <fp-input label="URL del repositorio" type="url" testId="project-edit-repository-url" [value]="repositoryUrl()" (valueChange)="repositoryUrl.set($event)" />
          <fp-button type="submit" icon="save" testId="project-edit-submit" [disabled]="saving() || !canEditSettings()">Guardar cambios</fp-button>
        </form></fp-card>
        <fp-card><div class="actions">
          <section class="comments-section" aria-labelledby="project-comments-title"><h2 id="project-comments-title">Comentarios</h2><form data-testid="project-comment-form" (submit)="submitComment($event)"><label for="project-comment">Agregar comentario</label><textarea id="project-comment" rows="3" maxlength="4000" [value]="commentDraft()" (input)="commentDraft.set($any($event.target).value)" [disabled]="commentSubmitting()"></textarea><fp-button type="submit" icon="comment" [disabled]="commentSubmitting() || !commentDraft().trim()">Comentar</fp-button></form>@if (commentLoading()) { <p role="status">Cargando comentarios...</p> } @if (sectionCommentError(); as message) { <p class="error" role="alert" data-testid="project-comment-error">{{ message }}</p> } @for (comment of projectComments(); track comment.id) { <article class="project-comment"><div class="comment-meta"><strong>{{ comment.authorName || 'Usuario' }}</strong><span>{{ comment.createdAt | date:'d MMM y, HH:mm' }}</span></div>@if (editingCommentId() === comment.id) { <textarea rows="3" aria-label="Editar comentario" [value]="editingContent()" (input)="editingContent.set($any($event.target).value)"></textarea><fp-button type="button" icon="save" ariaLabel="Guardar comentario" (click)="saveComment(comment.id)">Guardar</fp-button> } @else { <p>{{ comment.content }}</p>@if (canEdit(comment)) { <div class="comment-actions"><fp-button type="button" variant="secondary" icon="edit" ariaLabel="Editar comentario" (click)="startEdit(comment)">Editar</fp-button><fp-button type="button" variant="danger" icon="delete" ariaLabel="Eliminar comentario" (click)="confirmDeleteComment(comment.id)">Eliminar</fp-button></div> } }</article> }</section><section class="activity-section" aria-labelledby="project-activity-title"><h2 id="project-activity-title">Actividad</h2>@for (event of activity(); track event.id) { <article class="activity-event"><span>{{ event.createdAt | date:'d MMM y, HH:mm' }}</span><p>{{ event.displayText }}</p></article> }</section>
              @for (resetToken of [statusResetToken()]; track resetToken) {
                <fp-select label="Estado" testId="project-status-select" [value]="current.status" [options]="statusOptions" [disabled]="saving() || !canEditSettings()" (valueChange)="onStatusChange($event)" />
              }
          <fp-button variant="danger" icon="delete" testId="project-delete" [disabled]="deleting() || !canDelete()" (click)="confirmingDelete.set(true)">Eliminar proyecto</fp-button>
        </div></fp-card>
      }
      @if (confirmingDelete()) { <fp-dialog data-testid="project-delete-dialog" label="project-delete-dialog-title" describedById="project-delete-dialog-description" (closed)="confirmingDelete.set(false)"><h2 id="project-delete-dialog-title">Eliminar proyecto</h2><p id="project-delete-dialog-description">¿Seguro que querés eliminar este proyecto? Esta acción no se puede deshacer.</p><div class="actions"><fp-button variant="danger" icon="delete" testId="project-delete-confirm" (click)="onDelete()">Sí, eliminar</fp-button><fp-button variant="secondary" icon="close" testId="project-delete-cancel" (click)="confirmingDelete.set(false)">Cancelar</fp-button></div></fp-dialog> }
      @if (deletingCommentId(); as commentId) { <fp-dialog data-testid="comment-delete-dialog" label="comment-delete-dialog-title" describedById="comment-delete-dialog-description" (closed)="cancelDeleteComment()"><h2 id="comment-delete-dialog-title">Eliminar comentario</h2><p id="comment-delete-dialog-description">¿Seguro que querés eliminar este comentario? Esta acción no se puede deshacer.</p>@if (commentError(); as message) { <p class="error" role="alert" data-testid="comment-delete-dialog-error">{{ message }}</p> }<div class="actions"><fp-button variant="danger" icon="delete" testId="comment-delete-confirm" [disabled]="commentSubmitting()" (click)="deleteCommentConfirmed()">Sí, eliminar</fp-button><fp-button variant="secondary" icon="close" testId="comment-delete-cancel" (click)="cancelDeleteComment()">Cancelar</fp-button></div></fp-dialog> }
    </main>
  `,
  styles: `
    .project-detail { display:flex; flex-direction:column; gap:var(--fp-space-6); width:100%; max-width:1120px; margin:0 auto; padding:clamp(var(--fp-space-6), 5vw, var(--fp-space-12)) clamp(var(--fp-space-4), 4vw, var(--fp-space-8)); }
    .detail-header { display:flex; align-items:flex-start; justify-content:space-between; gap:var(--fp-space-6); }
    .project-context-links { display:flex; flex-wrap:wrap; gap:var(--fp-space-3); margin-bottom:var(--fp-space-3); }
    .project-link,.project-back-link { display:inline-flex; align-items:center; gap:var(--fp-space-2); color:var(--fp-accent); text-decoration:none; }
    .project-context-links a { flex:0 1 auto; }
    .detail-header > fp-badge { flex-shrink:0; }
    h1,h2,.eyebrow { margin:0; font-family:var(--fp-font-display); color:var(--fp-text); } h1 { font-size:2rem; } h2 { font-size:1.25rem; margin-bottom:var(--fp-space-4); }
    /* Explicit font-weight (kept at the pre-redesign normal weight) so this
       accent-colored local variant stays independent of the global
       .eyebrow utility promoted in PR6a, which sets font-weight: 700 —
       see PR6a verify-report WARNING 7. This is a deliberate "stay normal"
       decision, not an accident. */
    .eyebrow { color:var(--fp-accent); text-transform:uppercase; letter-spacing:.12em; font-size:.75rem; font-weight:400; }
    form,.summary,.comments-section,.activity-section { display:flex; flex-direction:column; gap:var(--fp-space-4); } .summary span,.project-comment span,.activity-event span { color:var(--fp-text-muted); font-size:.875rem; } .project-comment,.activity-event { border-top:1px solid var(--fp-border); padding-top:var(--fp-space-3); display:flex; flex-direction:column; align-items:flex-start; gap:var(--fp-space-2); } .project-comment p,.activity-event p { margin:0; } .comment-meta { display:flex; align-items:baseline; gap:var(--fp-space-2); } .comment-actions { display:flex; gap:var(--fp-space-3); } .project-comment textarea { width:100%; font-family:inherit; } .error { color:var(--fp-danger); }
        @media (max-width: 700px) { .project-detail { padding:var(--fp-space-4); } .detail-header,.actions { align-items:stretch; flex-direction:column; } .project-context-links { align-items:stretch; flex-direction:column; } .project-context-links a { width:100%; } }
  `,
})
export class ProjectDetailComponent {
  private readonly store = inject(ProjectsStore);
  private readonly router = inject(Router);
  readonly projectId = input.required<number, string>({ transform: numberAttribute });
  readonly project = this.store.selectedProject;
  readonly loading = this.store.detailLoading;
  readonly saving = this.store.saving;
  readonly deleting = this.store.deleting;
  readonly error = this.store.error;
  readonly statusOptions = STATUS_OPTIONS;
      private readonly commentsStore = inject(CommentsStore);
      readonly projectComments = this.commentsStore.projectComments;
      readonly activity = this.commentsStore.activity;
      readonly commentLoading = this.commentsStore.loading;
      readonly commentSubmitting = this.commentsStore.submitting;
      readonly commentError = this.commentsStore.error;
      readonly commentDraft = signal('');
      readonly editingCommentId = signal<number | null>(null);
      readonly editingContent = signal('');
      readonly deletingCommentId = signal<number | null>(null);
      /**
       * `fp-dialog` is a fixed full-viewport backdrop with `aria-modal="true"`
       * and a focus trap, so an error rendered in `.comments-section` sits
       * visually behind the backdrop and outside the trap — invisible and
       * unreachable while the delete confirmation is open. While that dialog
       * is open the error is rendered inside the dialog instead; this computed
       * suppresses the section copy so the same message is never announced
       * twice by two `role="alert"` nodes.
       */
      readonly sectionCommentError = computed(() => (this.deletingCommentId() === null ? this.commentError() : null));
  protected readonly statusBadgeVariant = projectStatusBadgeVariant;
  readonly name = signal(''); readonly description = signal(''); readonly code = signal(''); readonly startDate = signal(''); readonly estimatedEndDate = signal(''); readonly technologies = signal(''); readonly repositoryUrl = signal('');
  readonly confirmingDelete = signal(false);
  /**
   * Bumped on a failed status update to force `@for`'s `track` to recreate
   * the `<fp-select>` (and its native `<select>`). Angular's property-binding
   * diffing skips re-applying `[selected]` when `current.status` itself
   * hasn't changed (the update failed, so the store's project is unchanged),
   * but the browser already moved its own live selection to whatever the
   * user just clicked — recreating the element is what actually discards
   * that stale native selection and shows the real persisted status again.
   */
  readonly statusResetToken = signal(0);
  readonly canEditSettings = computed(() => hasPermission(this.project(), 'PROJECT_EDIT_SETTINGS'));
  readonly canDelete = computed(() => hasPermission(this.project(), 'PROJECT_DELETE'));

  constructor() {
    effect(() => {
      this.projectId();
      this.resetEditState();
      this.confirmingDelete.set(false);
      this.store.loadProject(this.projectId());
          this.commentsStore.loadProject(this.projectId());
    });
    effect(() => {
      const p = this.project();
      if (p) {
        this.name.set(p.name); this.description.set(p.description ?? ''); this.code.set(p.code ?? '');
        this.startDate.set(p.startDate ?? ''); this.estimatedEndDate.set(p.estimatedEndDate ?? '');
        this.technologies.set(p.technologies ?? ''); this.repositoryUrl.set(p.repositoryUrl ?? '');
      }
    });
  }
  onSubmit(event: Event): void { event.preventDefault(); const name = this.name().trim(); if (!name) return; this.store.updateProject(this.projectId(), { name, description: blank(this.description()), code: blank(this.code()), startDate: blank(this.startDate()), estimatedEndDate: blank(this.estimatedEndDate()), technologies: blank(this.technologies()), repositoryUrl: blank(this.repositoryUrl()) }); }
  async onStatusChange(value: string): Promise<void> {
    if (!value) return;
    const succeeded = await this.store.updateProjectStatus(this.projectId(), value as ProjectStatus);
    if (!succeeded) this.statusResetToken.update((token) => token + 1);
  }
  /**
   * Local UI state (draft text, edit mode, pending delete) is only cleared once
   * the store confirms the write succeeded — otherwise a failed request would
   * silently discard what the user typed while the error message is shown.
   */
  async submitComment(event: Event): Promise<void> { event.preventDefault(); const content = this.commentDraft().trim(); if (!content) return; const created = await this.commentsStore.createProject(this.projectId(), content); if (created) this.commentDraft.set(''); }
      canEdit(comment: Comment): boolean { return comment.authorId === this.commentsStore.currentUserId(); }
      startEdit(comment: Comment): void { this.editingCommentId.set(comment.id); this.editingContent.set(comment.content); }
      async saveComment(id: number): Promise<void> { const content = this.editingContent().trim(); if (!content) return; const saved = await this.commentsStore.update(id, content, 'project'); if (saved) this.editingCommentId.set(null); }
      confirmDeleteComment(id: number): void { this.deletingCommentId.set(id); }
      cancelDeleteComment(): void { this.deletingCommentId.set(null); }
      async deleteCommentConfirmed(): Promise<void> { const id = this.deletingCommentId(); if (id === null) return; const deleted = await this.commentsStore.delete(id, 'project'); if (deleted) this.deletingCommentId.set(null); }

      async onDelete(): Promise<void> {
    const deleted = await this.store.deleteProject(this.projectId());
    if (!deleted) return;
    this.confirmingDelete.set(false);
    await this.router.navigate(['/projects']);
  }

  private resetEditState(): void {
    this.name.set(''); this.description.set(''); this.code.set(''); this.startDate.set('');
    this.estimatedEndDate.set(''); this.technologies.set(''); this.repositoryUrl.set('');
  }
}
function blank(value: string): string | null { const trimmed = value.trim(); return trimmed ? trimmed : null; }
