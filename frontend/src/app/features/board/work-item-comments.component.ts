import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FpButtonComponent } from '../../shared/ui/button.component';
import { FpDialogComponent } from '../../shared/ui/dialog.component';
import { Comment } from '../comments/comments.model';
import { CommentsStore } from '../comments/comments.store';

/**
 * Work-item comments section of the board detail panel: list, create, inline
 * edit and delete (behind its own confirmation dialog). Loading the comments
 * stays with the board (it calls `CommentsStore.loadWorkItem` when an item is
 * opened); this component only renders and writes them.
 */
@Component({
  selector: 'fp-work-item-comments',
  standalone: true,
  imports: [FormsModule, DatePipe, FpButtonComponent, FpDialogComponent],
  template: `
    <section class="work-comments" aria-labelledby="work-comments-title">
      <h4 id="work-comments-title">Comentarios</h4>
      <form data-testid="work-comment-form" (ngSubmit)="submitWorkComment()">
        <label for="work-comment">Agregar comentario</label>
        <textarea
          id="work-comment"
          rows="3"
          maxlength="4000"
          [(ngModel)]="commentDraft"
          name="work-comment"
          [disabled]="commentSubmitting()"
        ></textarea>
        <fp-button type="submit" icon="comment" [disabled]="commentSubmitting() || !commentDraft.trim() || !canComment()">Comentar</fp-button>
      </form>
      @if (commentLoading()) {
        <p role="status" aria-live="polite">Cargando comentarios...</p>
      }
      @if (sectionCommentError(); as message) {
        <p class="board-error" role="alert">{{ message }}</p>
      }
      @for (comment of workComments(); track comment.id) {
        <article class="work-comment">
          <div class="comment-meta">
            <strong>{{ comment.authorName || 'Usuario' }}</strong>
            <span>{{ comment.createdAt | date: 'd MMM y, HH:mm' }}</span>
          </div>
          @if (editingCommentId() === comment.id) {
            <textarea
              rows="3"
              aria-label="Editar comentario"
              [value]="editingContent()"
              (input)="editingContent.set($any($event.target).value)"
            ></textarea>
            <fp-button type="button" icon="save" ariaLabel="Guardar comentario" (click)="saveComment(comment.id)">Guardar comentario</fp-button>
          } @else {
            <p>{{ comment.content }}</p>
            @if (canEdit(comment)) {
              <div class="comment-actions">
                <fp-button type="button" variant="secondary" icon="edit" ariaLabel="Editar comentario" (click)="startEdit(comment)">Editar</fp-button>
                <fp-button type="button" variant="danger" icon="delete" ariaLabel="Eliminar comentario" (click)="confirmDeleteComment(comment.id)">Eliminar</fp-button>
              </div>
            }
          }
        </article>
      }
    </section>

    @if (deletingCommentId(); as commentId) {
      <fp-dialog
        data-testid="comment-delete-dialog"
        label="comment-delete-dialog-title"
        describedById="comment-delete-dialog-description"
        (closed)="cancelDeleteComment()"
      >
        <h3 id="comment-delete-dialog-title">Eliminar comentario</h3>
        <p id="comment-delete-dialog-description">¿Seguro que querés eliminar este comentario? Esta acción no se puede deshacer.</p>
        @if (commentError(); as message) {
          <p class="board-error" role="alert" data-testid="comment-delete-dialog-error">{{ message }}</p>
        }
        <div class="panel-actions">
          <fp-button variant="danger" icon="delete" type="button" (click)="deleteCommentConfirmed()">Sí, eliminar</fp-button>
          <fp-button variant="secondary" icon="close" type="button" (click)="cancelDeleteComment()">Cancelar</fp-button>
        </div>
      </fp-dialog>
    }
  `,
  styleUrl: './work-item-comments.component.scss',
})
export class WorkItemCommentsComponent {
  private readonly commentsStore = inject(CommentsStore, { optional: true });

  /** The open work item whose comments are shown and written. */
  readonly workItemId = input.required<number>();
  /** Caller holds `COMMENT_CREATE` on the project (fail-closed gate for the create button). */
  readonly canComment = input.required<boolean>();

  readonly workComments = computed(() => this.commentsStore?.workItemComments() ?? []);
  readonly commentLoading = computed(() => this.commentsStore?.workItemLoading() ?? false);
  readonly commentSubmitting = computed(() => this.commentsStore?.submitting() ?? false);
  readonly commentError = computed(() => this.commentsStore?.error() ?? null);
  readonly editingCommentId = signal<number | null>(null);
  readonly editingContent = signal('');
  commentDraft = '';
  readonly deletingCommentId = signal<number | null>(null);
  /**
   * `fp-dialog` is a fixed full-viewport backdrop with `aria-modal="true"`
   * and a focus trap, so an error rendered in `.work-comments` sits
   * visually behind the backdrop and outside the trap while the delete
   * confirmation dialog is open. While that dialog is open the error is
   * rendered inside the dialog instead (see `comment-delete-dialog-error`
   * above); this computed suppresses the section copy so the same
   * message is never announced twice by two `role="alert"` nodes.
   * Mirrors ProjectDetailComponent's `sectionCommentError`.
   */
  readonly sectionCommentError = computed(() => (this.deletingCommentId() === null ? this.commentError() : null));

  /**
   * Local UI state (draft text, edit mode, pending delete) is only cleared once
   * the store confirms the write succeeded — otherwise a failed request would
   * silently discard what the user typed while the error message is shown.
   * Mirrors ProjectDetailComponent's comment methods (same CommentsStore
   * `Promise<boolean>` contract).
   */
  async submitWorkComment(): Promise<void> {
    const content = this.commentDraft.trim();
    if (!content || !this.commentsStore) return;
    const created = await this.commentsStore.createWorkItem(this.workItemId(), content);
    if (created) this.commentDraft = '';
  }

  canEdit(comment: Comment): boolean {
    const id = this.commentsStore?.currentUserId();
    return id !== null && id !== undefined && comment.authorId === id;
  }

  startEdit(comment: Comment): void {
    this.editingCommentId.set(comment.id);
    this.editingContent.set(comment.content);
  }

  async saveComment(id: number): Promise<void> {
    const content = this.editingContent().trim();
    if (!content || !this.commentsStore) return;
    const saved = await this.commentsStore.update(id, content, 'workItem');
    if (saved) this.editingCommentId.set(null);
  }

  confirmDeleteComment(id: number): void {
    this.deletingCommentId.set(id);
  }

  cancelDeleteComment(): void {
    this.deletingCommentId.set(null);
  }

  async deleteCommentConfirmed(): Promise<void> {
    const id = this.deletingCommentId();
    if (id === null || !this.commentsStore) return;
    const deleted = await this.commentsStore.delete(id, 'workItem');
    if (deleted) this.deletingCommentId.set(null);
  }
}
